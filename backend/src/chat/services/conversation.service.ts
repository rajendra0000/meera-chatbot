import { ChatStep, ConversationChannel, ConversationStatus, MessageRole } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ConversationHelper } from "../../helpers/conversation.helper.js";
import { CollectedData } from "../../types/conversation.types.js";
import { ConversationRepository } from "../repositories/conversation.repository.js";
import { ConversationVersionConflictError } from "../repositories/conversation.repository.js";
import { MessageRepository } from "../repositories/message.repository.js";
import { LeadRepository } from "../repositories/lead.repository.js";
import { ShowroomRepository } from "../repositories/showroom.repository.js";
import { ChatRuntimeDeps, ProcessChatInput, ProcessMessageInput, ProcessMessageOutput } from "../types/chat.types.js";
import { ContextService } from "./context.service.js";
import { SafetyService } from "./safety.service.js";
import { HandoverService } from "./handover.service.js";
import { IntentService } from "./intent.service.js";
import { EntityExtractorService } from "./entity-extractor.service.js";
import { StateMachineService } from "./state-machine.service.js";
import { ProductService, mapProductTypeToCategory } from "./product.service.js";
import { ResponseService } from "./response.service.js";
import { ChannelRendererService } from "./channel-renderer.service.js";
import { withRetries } from "../utils/retry.util.js";
import { prepareLeadUpsert } from "../../services/lead.service.js";

const CONVERSATION_WRITE_ATTEMPTS = 3;
const NON_RECOMMEND_INTENTS = new Set<string>([
  "FAQ",
  "IRRELEVANT",
  "SMALL_TALK",
  "SECURITY_ATTACK",
  "EMPTY",
  "SPAM",
  "RESET",
  "PURCHASE_INTENT",
] as const);
const RECOMMENDATION_REFRESH_FIELDS = new Set(["productType", "budget"] as const);

function safePromptBundle(bundle: Awaited<ReturnType<ChatRuntimeDeps["getActivePromptBundle"]>>) {
  return bundle ?? {
    system: "",
    learning: "",
    combined: "",
    promptVersionId: null,
    promptVersionLabel: "Default Prompt",
  };
}

function dedupeReplyParagraphs(reply: string) {
  const seen = new Set<string>();
  return reply
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter((part) => {
      if (!part || seen.has(part)) return false;
      seen.add(part);
      return true;
    })
    .join("\n\n");
}

function isBudgetGuard(collectedData: CollectedData) {
  const budget = String(collectedData.budget ?? "");
  const category = mapProductTypeToCategory(String(collectedData.productType ?? ""));
  return category === "Wall Panels (H-UHPC)" && Boolean(budget) && budget !== "Ã¢â€šÂ¹400+/sqft" && budget !== "â‚¹400+/sqft" && budget !== "Flexible";
}

function isRetryableConversationWriteError(error: unknown) {
  if (error instanceof ConversationVersionConflictError) {
    return true;
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as { code?: string }).code === "P2028";
  }

  return error instanceof Error && error.message.includes("P2028");
}

function shouldRefreshRecommendations(input: {
  currentStep: ChatStep;
  intent: string;
  appliedUpdates: Array<{ field: string }>;
}) {
  return (
    input.currentStep === ChatStep.COMPLETED &&
    input.intent === "FIELD_UPDATE" &&
    input.appliedUpdates.some((update) => RECOMMENDATION_REFRESH_FIELDS.has(update.field as "productType" | "budget"))
  );
}

export class ConversationService {
  private readonly contextService = new ContextService();
  private readonly safetyService = new SafetyService();
  private readonly handoverService = new HandoverService();
  private readonly intentService: IntentService;
  private readonly entityExtractorService = new EntityExtractorService();
  private readonly stateMachineService = new StateMachineService();
  private readonly productService = new ProductService();
  private readonly responseService: ResponseService;
  private readonly channelRenderer = new ChannelRendererService();
  private readonly conversationRepository = new ConversationRepository();
  private readonly messageRepository = new MessageRepository();
  private readonly leadRepository = new LeadRepository();
  private readonly showroomRepository = new ShowroomRepository();

  constructor(private readonly deps: ChatRuntimeDeps) {
    this.intentService = new IntentService(deps);
    this.responseService = new ResponseService(deps);
  }

  async processMessage(input: ProcessMessageInput): Promise<ProcessMessageOutput> {
    const promptBundle = safePromptBundle(await this.deps.getActivePromptBundle().catch(() => null));
    const moreImages = await this.productService.handleMoreImagesFlow({
      message: input.message,
      currentStep: input.currentStep,
      collectedData: input.collectedData,
      lastRecommendedProductIds: input.lastRecommendedProductIds,
    });
    if (moreImages.handled) {
      return {
        reply: moreImages.reply,
        nextStep: moreImages.nextStep,
        collectedData: moreImages.collectedData as CollectedData,
        recommendProducts: moreImages.recommendProducts,
        isMoreImages: moreImages.isMoreImages,
        isBrowseOnly: false,
        quickReplies: moreImages.quickReplies,
        handover: false,
        triggerType: null,
        promptVersionId: promptBundle.promptVersionId,
        promptVersionLabel: promptBundle.promptVersionLabel,
      };
    }

    const safety = this.safetyService.inspect(input.message);
    const explicitHandover = this.handoverService.detectExplicitHandover(input.message);
    const intent = await this.intentService.classify({
      message: input.message,
      currentStep: input.currentStep,
      currentData: input.collectedData,
      forcedIntent: safety.intentOverride,
      handoverRequested: explicitHandover,
    });

    const deterministicUpdates = this.entityExtractorService.buildDeterministicUpdates(
      input.message,
      input.currentStep,
      input.collectedData
    );
    const mergedUpdates = this.entityExtractorService.mergeUpdates(intent, deterministicUpdates);
    const applied = this.entityExtractorService.applyUpdates(input.collectedData, mergedUpdates, input.currentStep);
    const normalizedIntent =
      (intent.intent === "IRRELEVANT" || intent.intent === "SMALL_TALK") && applied.appliedUpdates.length > 0
        ? {
            ...intent,
            intent: input.currentStep === ChatStep.COMPLETED ? "FIELD_UPDATE" as const : "STEP_ANSWER" as const,
            confidence: Math.max(intent.confidence, 0.65),
          }
        : intent;
    const nextData = { ...applied.collectedData };

    if (normalizedIntent.notes.includes("name_refusal")) {
      nextData.nameRetryCount = Number(nextData.nameRetryCount ?? 0) + 1;
    } else if (typeof nextData.name === "string" && nextData.name.trim()) {
      nextData.nameRetryCount = 0;
    }

    const transition = this.stateMachineService.transition({
      currentStep: input.currentStep,
      currentData: input.collectedData,
      nextData,
      appliedUpdates: applied.appliedUpdates,
      rejectedUpdates: applied.rejectedUpdates,
      intent: normalizedIntent,
      handoverTrigger: explicitHandover ? "Explicit Team Request" : null,
    });

    const faqResults = normalizedIntent.intent === "FAQ" ? await this.deps.searchFaqByKeywords(input.message) : [];
    const locationKeywords = ["showroom", "dealer", "visit", "store", "where", "location", "city", "near"];
    const hasLocationQuery = locationKeywords.some((keyword) => input.message.toLowerCase().includes(keyword));
    let showroomMsg: string | null = null;

    if (typeof transition.collectedData.city === "string" && transition.collectedData.city.trim()) {
      const justExtractedCity = applied.appliedUpdates.some((update) => update.field === "city");
      const shouldLookupShowroom =
        normalizedIntent.intent === "PURCHASE_INTENT" || justExtractedCity || hasLocationQuery;

      if (shouldLookupShowroom) {
        const showrooms = await this.showroomRepository.findAll();
        const match = showrooms.find((showroom) =>
          showroom.city.toLowerCase().includes(String(transition.collectedData.city).toLowerCase())
        );
        if (match) {
          showroomMsg = `Great news - we have a showroom near you.\n${match.name} - ${match.address}\nContact: ${match.contact ?? "available on request"}`;
        }
      }
    }

    let recommendProducts: ProcessMessageOutput["recommendProducts"] = [];
    let exhausted = false;
    const hasShownProducts = transition.collectedData.hasShownProducts === true;
    const shouldRecommendProducts =
      !transition.handoverTrigger &&
      !NON_RECOMMEND_INTENTS.has(normalizedIntent.intent) &&
      (
        normalizedIntent.intent === "SHOW_PRODUCTS" ||
        normalizedIntent.intent === "MORE_PRODUCTS" ||
        shouldRefreshRecommendations({
          currentStep: input.currentStep,
          intent: normalizedIntent.intent,
          appliedUpdates: applied.appliedUpdates,
        }) ||
        (transition.nextStep === ChatStep.COMPLETED && input.currentStep !== ChatStep.COMPLETED && !hasShownProducts)
      );

    if (shouldRecommendProducts) {
      const recommendation = await this.productService.buildRecommendation({
        collectedData: transition.collectedData,
        limit: normalizedIntent.intent === "SHOW_PRODUCTS" ? 3 : 4,
        excludeIds: normalizedIntent.intent === "MORE_PRODUCTS" ? transition.collectedData.shownProductIds ?? [] : [],
      });
      recommendProducts = recommendation.products;
      exhausted = recommendation.exhausted;
      if (recommendProducts.length > 0) {
        transition.collectedData = {
          ...transition.collectedData,
          hasShownProducts: true,
          shownProductIds: Array.from(
            new Set([...(transition.collectedData.shownProductIds ?? []), ...recommendProducts.map((product) => product.id)])
          ),
        };
      }
    }

    const nextStep = normalizedIntent.intent === "FAQ" ? input.currentStep : transition.nextStep;
    const quickReplies = nextStep === ChatStep.COMPLETED ? [] : ConversationHelper.getQuickReplies(nextStep);
    const plan = await this.responseService.buildPlan({
      currentStep: input.currentStep,
      nextStep,
      intent: normalizedIntent,
      collectedData: transition.collectedData,
      phrasingPayload: {
        CURRENT_STEP: nextStep,
        COLLECTED_DATA: transition.collectedData,
        NORMALIZED_INPUT: {
          messageType: normalizedIntent.intent === "FIELD_UPDATE" ? "STEP_ANSWER" : normalizedIntent.intent,
          fieldUpdates: mergedUpdates,
        },
      },
      safetyFlags: safety.flags,
      faqResults,
      showroomMsg,
      recommendProducts,
      quickReplies,
      handover: transition.status === ConversationStatus.HANDOVER,
      triggerType: transition.handoverTrigger,
      promptVersionId: promptBundle.promptVersionId,
      promptVersionLabel: promptBundle.promptVersionLabel,
      budgetGuard: isBudgetGuard(transition.collectedData),
      exhausted,
    });

    return {
      reply: dedupeReplyParagraphs(plan.reply),
      nextStep: plan.nextStep,
      collectedData: transition.collectedData,
      recommendProducts: plan.recommendProducts,
      isMoreImages: plan.isMoreImages,
      isBrowseOnly: plan.isBrowseOnly,
      quickReplies: plan.quickReplies,
      handover: plan.handover,
      triggerType: plan.triggerType,
      promptVersionId: plan.promptVersionId,
      promptVersionLabel: plan.promptVersionLabel,
    };
  }

  async processChat(input: ProcessChatInput) {
    const promptBundle = safePromptBundle(await this.deps.getActivePromptBundle().catch(() => null));
    const channel = input.channel ?? ConversationChannel.WEB;
    const incomingMessage = input.message?.trim() ?? "";

    let conversation = input.conversationId
      ? await this.conversationRepository.findById(input.conversationId)
      : null;
    if (!conversation && input.contactId) {
      conversation = await this.conversationRepository.findLatestByContact(input.contactId, channel);
    }
    if (!conversation) {
      conversation = await this.conversationRepository.createConversation({ channel, contactId: input.contactId });
    }

    if (!incomingMessage || input.bootstrap) {
      const greeting = "Hi, I'm Meera from Hey Concrete. I'd love to help.\nMay I know your name first?";
      await this.messageRepository.createMessage({
        conversationId: conversation.id,
        role: MessageRole.ASSISTANT,
        content: greeting,
        metadata: {
          promptVersionId: promptBundle.promptVersionId,
          promptVersionLabel: promptBundle.promptVersionLabel,
        },
      });

      return {
        conversationId: conversation.id,
        ...this.channelRenderer.renderResponse({
          reply: greeting,
          stepQuestion: null,
          nextStep: ChatStep.NAME,
          quickReplies: ConversationHelper.getQuickReplies(ChatStep.NAME),
          recommendProducts: [],
          isMoreImages: false,
          isBrowseOnly: false,
          handover: false,
          triggerType: null,
          promptVersionId: promptBundle.promptVersionId,
          promptVersionLabel: promptBundle.promptVersionLabel,
        }),
        nextStep: ChatStep.NAME,
        collectedData: {},
        lead: null,
      };
    }

    const conversationId = conversation.id;

    return withRetries(async () => {
      const latestConversation = await this.conversationRepository.findById(conversationId);
      if (!latestConversation) {
        throw new Error(`Conversation ${conversationId} no longer exists.`);
      }

      const [recentMessages, historicalMessages, existingLead] = await Promise.all([
        this.messageRepository.findRecentMessages(latestConversation.id, 6),
        this.messageRepository.findMessagesByConversationId(latestConversation.id),
        this.leadRepository.findByConversationId(latestConversation.id),
      ]);
      const history = recentMessages.reverse().map((message) => `${message.role}: ${message.content}`).slice(-6);
      const lastRecommendedProductIds = recentMessages.find((message) => {
        const metadata = message.metadata as { recommendedProductIds?: string[] } | null;
        return Array.isArray(metadata?.recommendedProductIds) && metadata.recommendedProductIds.length > 0;
      });

      const result = await this.processMessage({
        message: incomingMessage,
        currentStep: latestConversation.step,
        collectedData: (latestConversation.collectedData as CollectedData | null) ?? {},
        history,
        lastRecommendedProductIds: ((lastRecommendedProductIds?.metadata as { recommendedProductIds?: string[] } | null)?.recommendedProductIds ?? []),
      });

      const userMessages = [
        ...historicalMessages
          .filter((message) => message.role === MessageRole.USER)
          .map((message) => message.content),
        incomingMessage,
      ];
      const leadPlan = prepareLeadUpsert({
        conversationId: latestConversation.id,
        customerName: latestConversation.customerName,
        existingLead: existingLead
          ? {
              status: existingLead.status,
              triggerType: existingLead.triggerType,
            }
          : null,
        collectedData: result.collectedData,
        recommendedProducts: result.recommendProducts,
        latestUserInput: incomingMessage,
        userMessages,
      });

      const finalData = leadPlan?.collectedData ?? result.collectedData;
      const finalHandover = result.handover || Boolean(leadPlan?.trigger);
      const finalStep = finalHandover ? ChatStep.COMPLETED : result.nextStep;

      await prisma.$transaction(async (tx) => {
        const txMessageRepository = new MessageRepository(tx);
        const txConversationRepository = new ConversationRepository(tx);
        const txLeadRepository = new LeadRepository(tx);

        await txMessageRepository.createMessage({
          conversationId: latestConversation.id,
          role: MessageRole.USER,
          content: incomingMessage,
        });

        if (leadPlan) {
          await txLeadRepository.upsertPreparedLead(leadPlan);
        }

        const finalStatus = finalHandover
          ? ConversationStatus.HANDOVER
          : finalStep === ChatStep.COMPLETED
            ? ConversationStatus.COMPLETED
            : ConversationStatus.ACTIVE;

        await txConversationRepository.updateConversation({
          id: latestConversation.id,
          customerName: String(finalData.name ?? latestConversation.customerName ?? ""),
          step: finalStep,
          status: finalStatus,
          collectedData: finalData,
          expectedVersion: latestConversation.version,
        });

        await txMessageRepository.createMessage({
          conversationId: latestConversation.id,
          role: MessageRole.ASSISTANT,
          content: result.reply,
          metadata: {
            nextStep: finalStep,
            recommendedProductIds: result.recommendProducts.map((product) => product.id),
            handover: finalHandover,
            promptVersionId: result.promptVersionId,
            promptVersionLabel: result.promptVersionLabel,
          },
        });
      });

      const refreshedLead = await this.leadRepository.findByConversationId(latestConversation.id);
      const payload = this.channelRenderer.renderResponse({
        reply: result.reply,
        stepQuestion: null,
        nextStep: finalStep,
        quickReplies: finalStep === ChatStep.COMPLETED ? [] : result.quickReplies,
        recommendProducts: result.recommendProducts,
        isMoreImages: result.isMoreImages,
        isBrowseOnly: result.isBrowseOnly,
        handover: finalHandover,
        triggerType: result.triggerType,
        promptVersionId: result.promptVersionId,
        promptVersionLabel: result.promptVersionLabel,
      });

      return {
        conversationId: latestConversation.id,
        ...payload,
        nextStep: finalStep,
        collectedData: finalData,
        lead: refreshedLead,
      };
    }, {
      attempts: CONVERSATION_WRITE_ATTEMPTS,
      shouldRetry: (error) => isRetryableConversationWriteError(error),
    });
  }
}
