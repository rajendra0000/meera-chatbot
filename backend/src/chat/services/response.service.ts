import { ChatStep } from "@prisma/client";
import { ConversationHelper } from "../../helpers/conversation.helper.js";
import { CollectedData } from "../../types/conversation.types.js";
import { ChatRuntimeDeps, ToneConfig } from "../types/chat.types.js";
import { ResponsePlan } from "../types/response.types.js";
import { IntentResult } from "../types/intent.types.js";
import { TEAM_HANDOVER_MESSAGE } from "./handover.service.js";
import { resolveActiveCategoryLock } from "./product.service.js";
import { ResponseValidatorService, enforceReplyShape } from "./response-validator.service.js";

const CALL2_REWRITE_PROMPT =
  "You are Meera, the tone layer for a WhatsApp sales chatbot. The BACKEND_APPROVED_REPLY is the source of truth for meaning, business logic, grounding, and question intent. Rewrite ONLY the approved reply. Do not change the meaning, do not change the question being asked, do not add facts, and do not make decisions. Your job is only HOW to say it. Match this voice exactly: warm, polished, concise, human, and confident, like a premium Hey Concrete consultant on WhatsApp. Use CONVERSATION_HISTORY and the latest assistant message to maintain continuity, avoid stale replies, and avoid repeating the same acknowledgement twice in a row. Follow TONE_CONFIG when provided: respect toneStyle, emojiStyle, preferredAcknowledgements, and customInstructions. If preferredAcknowledgements are provided, prefer them over default acknowledgements. Keep replies short and easy to scan, usually 1-2 short lines. Use the customer's name naturally when available, but not in every message. Use 0-1 emoji in most replies and never more than 2. Ask only one clear question, and keep it at the end. Acknowledge the latest user message before moving forward with smooth transitions like 'Great choice.', 'Thanks, Laksh!', 'That works nicely.', or 'Perfect.' when they fit. Avoid robotic or generic fillers such as 'That helps narrow it down', 'Sounds good', 'Based on your preferences', 'BTW', or 'quick question'. For product or image replies, sound like a consultant: concise, warm, and easy to scan. Never mention quick replies, buttons, internal steps, or backend logic. Return plain text only.";

const POST_HANDOFF_STATUS_OPTIONS = [
  "Kabir from our team will reach out soon.",
  "Kabir will connect with you shortly.",
  "Kabir will take it from here and reach out soon.",
] as const;
const POST_HANDOFF_REMINDER = "Kabir will guide you in detail when he connects.";

const STRUCTURED_QUICK_REPLY_STEPS = new Set<ChatStep>([
  ChatStep.AREA,
  ChatStep.STYLE,
  ChatStep.TIMELINE,
]);
const QUICK_REPLY_BLOCKED_INTENTS = new Set<string>([
  "FAQ",
  "SMALL_TALK",
  "IRRELEVANT",
  "SHOW_PRODUCTS",
  "MORE_IMAGES",
  "PRODUCT_SWITCH",
  "PURCHASE_INTENT",
]);

function splitShowroomMessage(showroomMsg: string | null) {
  const lines = showroomMsg
    ? showroomMsg
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
    : [];

  return {
    lead: lines[0] ?? null,
    details: lines.slice(1).join(" | ") || null,
  };
}

function buildComposedReply(primaryMessage: string | null, showroomMsg: string | null, stepQuestion: string | null) {
  const showroomParts = splitShowroomMessage(showroomMsg);
  const compactShowroomMsg = [showroomParts.lead, showroomParts.details].filter(Boolean).join("\n");

  return [primaryMessage, compactShowroomMsg, stepQuestion]
    .filter((item) => item && item.trim())
    .join("\n");
}

function parseHistoryEntry(entry: string) {
  const match = entry.match(/^\s*(user|assistant)\s*:\s*(.*)$/i);
  if (!match) {
    return null;
  }

  return {
    role: match[1].toLowerCase() as "user" | "assistant",
    content: match[2]?.trim() ?? "",
  };
}

function toConversationHistory(history: string[]) {
  return history
    .map((entry) => parseHistoryEntry(entry))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .slice(-10);
}

function getLatestAssistantMessage(history: string[]) {
  return [...history]
    .reverse()
    .map((entry) => parseHistoryEntry(entry))
    .find((entry) => entry?.role === "assistant")
    ?.content ?? null;
}

function getLatestAssistantAcknowledgement(history: string[]) {
  const latestAssistantMessage = getLatestAssistantMessage(history);
  if (!latestAssistantMessage) {
    return null;
  }

  const firstLine = latestAssistantMessage.split(/\r?\n+/)[0]?.trim() ?? "";
  if (!firstLine || firstLine.includes("?")) {
    return null;
  }

  const acknowledgment = firstLine.match(/^(.{1,40}?)(?:[.!?]|,|$)/)?.[1]?.trim() ?? "";
  return acknowledgment || null;
}

function getCurrentCategoryLabel(collectedData: CollectedData) {
  const category = resolveActiveCategoryLock(collectedData);
  return category ? category.replace(/\s*\(.*?\)\s*/g, "").trim() : "this category";
}

function getPreferredName(collectedData: CollectedData) {
  const rawName = typeof collectedData.name === "string" ? collectedData.name.trim() : "";
  if (!rawName) {
    return null;
  }

  const preferred = rawName.split(/\s+/)[0]?.trim() ?? "";
  if (!preferred || ["friend", "customer", "user"].includes(preferred.toLowerCase())) {
    return null;
  }

  return preferred;
}

function getLatestAssistantQuestion(history: string[]) {
  const assistantMessages = history
    .filter((entry) => entry.toLowerCase().startsWith("assistant:"))
    .map((entry) => entry.replace(/^assistant:\s*/i, "").trim())
    .reverse();

  for (const message of assistantMessages) {
    const question = message.match(/[^?]+\?/g)?.pop()?.trim();
    if (question) {
      return question;
    }
  }

  return null;
}

function questionsFeelRepeated(a: string, b: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const normalizedA = normalize(a);
  const normalizedB = normalize(b);

  if (!normalizedA || !normalizedB) {
    return false;
  }

  if (
    normalizedA === normalizedB ||
    normalizedA.includes(normalizedB) ||
    normalizedB.includes(normalizedA)
  ) {
    return true;
  }

  const tokensA = normalizedA.split(" ").filter((token) => token.length > 2);
  const tokensB = normalizedB.split(" ").filter((token) => token.length > 2);
  const overlap = tokensA.filter((token) => tokensB.includes(token)).length;
  return overlap >= Math.min(tokensA.length, tokensB.length, 4) && overlap > 0;
}

function getFreshStepQuestion(step: ChatStep, history: string[]) {
  const variants = ConversationHelper.getStepQuestionVariants(step);
  const lastQuestion = getLatestAssistantQuestion(history);
  if (!lastQuestion) {
    return variants[0] ?? ConversationHelper.getStepQuestion(step);
  }

  return variants.find((question) => !questionsFeelRepeated(question, lastQuestion)) ?? variants[0] ?? ConversationHelper.getStepQuestion(step);
}

function pickNonRepeatingReply(options: readonly string[], history: string[]) {
  const recentAssistantMessages = history
    .map((entry) => parseHistoryEntry(entry))
    .filter((entry): entry is NonNullable<typeof entry> => entry?.role === "assistant")
    .map((entry) => enforceReplyShape(entry.content))
    .slice(-3);

  return options.find((option) => !recentAssistantMessages.includes(enforceReplyShape(option))) ?? options[0] ?? "";
}

function maybeAppendPostHandoffReminder(reply: string) {
  const normalized = reply.toLowerCase();
  if (!reply.trim() || /kabir|contact you|reach out|connect with|team/i.test(normalized)) {
    return reply;
  }

  return `${reply}\n${POST_HANDOFF_REMINDER}`;
}

function getToneContext(collectedData: CollectedData) {
  const context: Record<string, string> = {};
  const addField = (key: string, value: unknown) => {
    if (typeof value !== "string" || !value.trim()) {
      return;
    }
    context[key] = value.trim();
  };

  addField("name", collectedData.name);
  addField("productType", collectedData.productType);
  addField("city", collectedData.city);
  addField("roomType", collectedData.roomType);
  addField("style", collectedData.style);
  addField("timeline", collectedData.timeline);

  return context;
}

function buildInvalidReply(currentStep: ChatStep, notes: string[]) {
  if (currentStep === ChatStep.NAME && notes.includes("name_refusal")) {
    return "A nickname works too. What should I call you?";
  }

  if (currentStep === ChatStep.STYLE) {
    return "Could you share the look you have in mind? Minimal, modern, geometric, textured, or statement.";
  }

  if (currentStep === ChatStep.TIMELINE) {
    return "Could you share your timeline? This Month, 1-3 Months, 3-6 Months, or Just Exploring.";
  }

  return ConversationHelper.getStepQuestion(currentStep);
}

function buildRedirectReply(nextStep: ChatStep, hasShownProducts: boolean, history: string[]) {
  if (nextStep === ChatStep.COMPLETED && hasShownProducts) {
    return "I can help compare these, share more photos, or help with the showroom. What would you like?";
  }

  if (nextStep === ChatStep.COMPLETED) {
    return "I can help with options, comparisons, or showroom details. What would you like to see?";
  }

  return getFreshStepQuestion(nextStep, history);
}

function extractReplyQuestion(text: string) {
  const matches = text.match(/[^?]+\?/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  return matches[matches.length - 1]?.trim() ?? null;
}

function replyQuestionMatchesStep(reply: string, step: ChatStep) {
  const question = extractReplyQuestion(reply);
  if (!question) {
    return false;
  }

  return ConversationHelper.getStepQuestionVariants(step)
    .some((variant) => questionsFeelRepeated(question, variant));
}

function normalizeToneConfig(toneConfig: ToneConfig | null | undefined) {
  if (!toneConfig) {
    return null;
  }

  const normalized: ToneConfig = {};

  if (Array.isArray(toneConfig.preferredAcknowledgements)) {
    normalized.preferredAcknowledgements = toneConfig.preferredAcknowledgements
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  if (typeof toneConfig.toneStyle === "string" && toneConfig.toneStyle.trim()) {
    normalized.toneStyle = toneConfig.toneStyle.trim();
  }

  if (typeof toneConfig.emojiStyle === "string" && toneConfig.emojiStyle.trim()) {
    normalized.emojiStyle = toneConfig.emojiStyle.trim();
  }

  if (typeof toneConfig.customInstructions === "string" && toneConfig.customInstructions.trim()) {
    normalized.customInstructions = toneConfig.customInstructions.trim();
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function shouldAttachQuickReplies(params: {
  nextStep: ChatStep;
  quickReplies: string[];
  reply: string;
  recommendProducts: ResponsePlan["recommendProducts"];
  intent: IntentResult;
  handover: boolean;
  isControlTurn: boolean;
}) {
  if (
    params.quickReplies.length === 0 ||
    params.handover ||
    params.isControlTurn ||
    params.intent.browseOnly ||
    params.recommendProducts.length > 0
  ) {
    return false;
  }

  if (!STRUCTURED_QUICK_REPLY_STEPS.has(params.nextStep)) {
    return false;
  }

  if (QUICK_REPLY_BLOCKED_INTENTS.has(params.intent.intent)) {
    return false;
  }

  return replyQuestionMatchesStep(params.reply, params.nextStep);
}

export class ResponseService {
  private readonly validatorService: ResponseValidatorService;

  constructor(private readonly deps: ChatRuntimeDeps) {
    this.validatorService = new ResponseValidatorService(deps);
  }

  async buildPlan(params: {
    userMessage: string;
    recentHistory: string[];
    currentStep: ChatStep;
    nextStep: ChatStep;
    latestCapturedField?: string | null;
    intent: IntentResult;
    collectedData: CollectedData;
    safetyFlags?: string[];
    faqResults: Array<{ answer: string }>;
    showroomMsg: string | null;
    recommendProducts: ResponsePlan["recommendProducts"];
    quickReplies: string[];
    handover: boolean;
    triggerType: string | null;
    promptVersionId: number | null;
    promptVersionLabel: string | null;
    budgetGuard: boolean;
    exhausted: boolean;
    toneConfig?: ToneConfig | null;
    postHandoffMode?: boolean;
    postHandoffInteractive?: boolean;
  }): Promise<ResponsePlan> {
    const faqAnswer = params.faqResults[0]?.answer ?? null;
    const city = String(params.collectedData.city ?? "").trim();
    const categoryLabel = getCurrentCategoryLabel(params.collectedData);
    const preferredName = getPreferredName(params.collectedData);
    const nextQuestion = params.nextStep === ChatStep.COMPLETED ? null : getFreshStepQuestion(params.nextStep, params.recentHistory);
    const showroomParts = splitShowroomMessage(params.showroomMsg);
    const conversationHistory = toConversationHistory(params.recentHistory);
    const latestAssistantMessage = getLatestAssistantMessage(params.recentHistory);
    const latestAssistantAcknowledgement = getLatestAssistantAcknowledgement(params.recentHistory);
    const isPostHandoffStatusTurn = params.postHandoffMode === true && params.postHandoffInteractive !== true && !params.handover;
    const isControlTurn =
      params.handover ||
      params.intent.intent === "PRODUCT_SWITCH" ||
      params.intent.intent === "SHOW_PRODUCTS" ||
      params.intent.intent === "MORE_IMAGES";
    const normalizedToneConfig = normalizeToneConfig(params.toneConfig);

    let approvedReply = "";
    let reply = "";
    let allowPhrasing = false;
    let replySource: ResponsePlan["replySource"] = "deterministic";
    let validatorAccepted = false;
    let validatorUsed = false;
    let validatorReason: string | null = isControlTurn ? "call2_skipped_control_turn" : null;

    if (isPostHandoffStatusTurn) {
      approvedReply = pickNonRepeatingReply(POST_HANDOFF_STATUS_OPTIONS, params.recentHistory);
      allowPhrasing = true;
    } else if (params.handover) {
      approvedReply = TEAM_HANDOVER_MESSAGE;
    } else if (params.intent.intent === "PRODUCT_SWITCH") {
      if (params.budgetGuard) {
        approvedReply = "Wall panels usually start around Rs 400+/sqft.\nWould you like to see Breeze Blocks or Brick Cladding instead?";
      } else {
        approvedReply = params.recommendProducts.length > 0
          ? `Switching to ${categoryLabel}.\nHere are a few options that could work well.`
          : `Switching to ${categoryLabel}.`;
      }
    } else if (params.intent.intent === "SHOW_PRODUCTS") {
      if (params.recommendProducts.length > 0) {
        approvedReply = `Here are a few ${categoryLabel.toLowerCase()} options that could work well for your space.`;
      } else if (params.exhausted) {
        approvedReply = `I don't have more verified ${categoryLabel.toLowerCase()} options right now.`;
      } else {
        approvedReply = `I can show you a few ${categoryLabel.toLowerCase()} options.`;
      }
    } else if (params.intent.intent === "MORE_IMAGES") {
      approvedReply = params.recommendProducts.length > 0
        ? "Of course. Here are a few more images."
        : "Tell me which option you'd like to see more images of.";
    } else if (params.safetyFlags?.includes("quote_request")) {
      approvedReply = "I can share a rough range here, but not a final quote. If you'd like, I can connect you with our team for an exact quote.";
    } else if (params.safetyFlags?.includes("discount_request")) {
      approvedReply = "I can't confirm discounts here, but I can help with the right options or connect you with our team.";
    } else if (params.intent.intent === "PURCHASE_INTENT") {
      if (!city) {
        approvedReply = "I'd be happy to help with that.\nWhich city should I check for you?";
      } else if (params.showroomMsg) {
        approvedReply = [
          preferredName
            ? `Thanks, ${preferredName}! We have a showroom in ${city}, so you're close to it.`
            : `We have a showroom in ${city}, so you're close to it.`,
          showroomParts.details,
          "Would you like the contact details or should I connect you with our team?",
        ]
          .filter((item) => item && item.trim())
          .join("\n");
      } else {
        approvedReply = preferredName
          ? `Thanks, ${preferredName}. I can help you take this forward in ${city}.\nWould you like me to connect you with our team?`
          : `I can help you take this forward in ${city}.\nWould you like me to connect you with our team?`;
      }
    } else if (params.intent.intent === "SECURITY_ATTACK") {
      approvedReply = "I can help with options, design guidance, or showroom details.";
    } else if (params.intent.intent === "EMPTY") {
      approvedReply = "I didn't catch that. Could you send it once more?";
    } else if (params.intent.intent === "SPAM") {
      approvedReply = "I couldn't make that out clearly. Could you send it once in simple words?";
    } else if (params.intent.intent === "RESET") {
      approvedReply = params.currentStep === ChatStep.COMPLETED
        ? "We can update any specific detail here, or start a new chat if you'd like."
        : "We can start fresh from here. Tell me the detail you'd like to change.";
    } else if (params.intent.intent === "FAQ" && faqAnswer) {
      approvedReply = params.postHandoffMode
        ? faqAnswer
        : params.currentStep === ChatStep.COMPLETED
        ? `${faqAnswer}\nWould you like help comparing options or checking a showroom?`
        : buildComposedReply(faqAnswer, params.showroomMsg, nextQuestion);
      allowPhrasing = !params.showroomMsg;
    } else if (params.intent.intent === "FAQ") {
      approvedReply = params.postHandoffMode
        ? "I don't have verified details on that here.\nKabir can help when he connects."
        : buildRedirectReply(params.nextStep, params.collectedData.hasShownProducts === true, params.recentHistory);
    } else if (params.intent.intent === "IRRELEVANT" || params.intent.intent === "SMALL_TALK") {
      approvedReply = buildRedirectReply(params.nextStep, params.collectedData.hasShownProducts === true, params.recentHistory);
    } else if (params.budgetGuard) {
      approvedReply = "Wall panels usually start around Rs 400+/sqft.\nWould you like to see Breeze Blocks or Brick Cladding instead?";
    } else if (params.intent.intent === "MORE_PRODUCTS" && params.exhausted) {
      approvedReply = `All ${categoryLabel.toLowerCase()} options are shown for now.\nWould you like to compare these or explore another category?`;
    } else if (params.nextStep === ChatStep.COMPLETED && params.recommendProducts.length > 0) {
      approvedReply = "Here are a few options that could work well for your space.\nPick one and I can compare them for you.";
    } else if (params.currentStep === ChatStep.COMPLETED && params.collectedData.hasShownProducts && params.recommendProducts.length === 0) {
      approvedReply = "I can help compare these, share more images, or help with the showroom.";
    } else if (params.intent.intent === "INVALID") {
      approvedReply = buildInvalidReply(params.nextStep === ChatStep.COMPLETED ? params.currentStep : params.nextStep, params.intent.notes);
    } else {
      approvedReply = buildComposedReply(null, params.showroomMsg, nextQuestion);
      allowPhrasing = !params.showroomMsg;
    }

    if (params.postHandoffMode && params.postHandoffInteractive && !params.handover) {
      approvedReply = maybeAppendPostHandoffReminder(approvedReply);
    }

    if (
      !isControlTurn &&
      !params.showroomMsg &&
      !params.budgetGuard &&
      params.intent.intent !== "INVALID"
    ) {
      allowPhrasing = true;
    }

    reply = approvedReply;

    if (allowPhrasing) {
      try {
        const phrasingPayload = {
          approvedReply,
          userMessage: params.userMessage,
          currentStep: params.nextStep,
          intent: params.intent.intent,
          conversationHistory,
          latestAssistantMessage,
          latestAssistantAcknowledgement,
          toneContext: getToneContext(params.collectedData),
          toneConfig: normalizedToneConfig,
          postHandoffMode: params.postHandoffMode === true,
        };
        const phrased = await this.deps.groqTextCompletion(
          CALL2_REWRITE_PROMPT,
          JSON.stringify(phrasingPayload)
        );
        if (phrased && phrased.trim()) {
          const validation = await this.validatorService.validatePolishedReply({
            userMessage: params.userMessage,
            recentHistory: params.recentHistory,
            intent: params.intent,
            currentStep: params.nextStep,
            approvedReply,
            candidateReply: phrased,
            recommendProducts: params.recommendProducts,
            handover: params.handover,
            showroomMsg: params.showroomMsg,
            collectedData: params.collectedData,
          });
          validatorUsed = true;
          validatorAccepted = validation.accepted;
          validatorReason = validation.reason;
          reply = validation.reply;
          if (validation.accepted && validation.source === "phrased") {
            replySource = "phrased";
          }
        } else {
          validatorReason = "call2_empty";
        }
      } catch {
        validatorReason = "call2_failed";
      }
    }

    const finalReply = enforceReplyShape(reply);
    const finalQuickReplies = shouldAttachQuickReplies({
      nextStep: params.nextStep,
      quickReplies: params.quickReplies,
      reply: finalReply,
      recommendProducts: params.recommendProducts,
      intent: params.intent,
      handover: params.handover,
      isControlTurn,
    })
      ? params.quickReplies
      : [];

    return {
      reply: finalReply,
      stepQuestion: nextQuestion,
      nextStep: params.nextStep,
      quickReplies: params.nextStep === ChatStep.COMPLETED ? [] : finalQuickReplies,
      recommendProducts: params.recommendProducts,
      isMoreImages: params.intent.intent === "MORE_IMAGES",
      isBrowseOnly: params.intent.browseOnly,
      handover: params.handover,
      triggerType: params.triggerType,
      promptVersionId: params.promptVersionId,
      promptVersionLabel: params.promptVersionLabel,
      replySource,
      validatorAccepted,
      validatorUsed,
      validatorReason,
    };
  }
}
