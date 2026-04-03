import { ChatStep } from "@prisma/client";
import { ConversationHelper } from "../../helpers/conversation.helper.js";
import { CollectedData } from "../../types/conversation.types.js";
import { ChatRuntimeDeps } from "../types/chat.types.js";
import { ResponsePlan } from "../types/response.types.js";
import { IntentResult } from "../types/intent.types.js";
import { TEAM_HANDOVER_MESSAGE } from "./handover.service.js";
import { resolveActiveCategoryLock } from "./product.service.js";
import { ResponseValidatorService, enforceReplyShape } from "./response-validator.service.js";

const CALL2_REWRITE_PROMPT =
  "Rewrite only the backend-approved WhatsApp reply as Meera. Keep the meaning, business logic, and question intent exactly the same. Do not add facts, do not change the ask, and do not make decisions. Use 1-3 short lines, warm human tone, and light WhatsApp phrasing. Avoid robotic lines like 'That helps', 'Sounds good', or 'Based on your preferences'. Return plain text only.";

const ACKNOWLEDGMENT_OPTIONS = {
  name: [
    "Nice to meet you",
    "Good to know",
    "Perfect",
  ],
  budget: [
    "Got it",
    "Perfect",
    "Okay",
  ],
  area: [
    "Perfect",
    "That works",
    "Got it",
  ],
  room: [
    "Nice",
    "Perfect",
    "Got it",
  ],
  style: [
    "Nice choice",
    "Perfect",
    "Nice",
  ],
  completed: [
    "Perfect",
    "Nice",
    "That works",
  ],
  generic: [
    "Got it",
    "Okay",
    "That works",
  ],
} as const;

const REDIRECT_OPTIONS = {
  collecting: [
    "Sure.",
    "Okay.",
    "Of course.",
  ],
  completed: [
    "Sure.",
    "Okay.",
    "I can help with that.",
  ],
} as const;

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

function buildAtomicReply(acknowledgment: string, showroomMsg: string | null, stepQuestion: string | null) {
  const showroomParts = splitShowroomMessage(showroomMsg);
  const compactShowroomMsg = [showroomParts.lead, showroomParts.details].filter(Boolean).join(" | ");
  const firstLine = [acknowledgment, !showroomMsg ? stepQuestion : null]
    .filter((item) => item && item.trim())
    .join(" ")
    .trim();

  return [firstLine, compactShowroomMsg, showroomMsg ? stepQuestion : null]
    .filter((item) => item && item.trim())
    .join("\n\n");
}

function firstName(name?: string) {
  return name?.trim().split(/\s+/)[0] ?? "";
}

function rotateCopy(
  collectedData: CollectedData,
  bucket: "usedAcknowledgements" | "usedRedirects",
  options: readonly string[]
) {
  const previous = Array.isArray(collectedData[bucket])
    ? collectedData[bucket].filter((item): item is string => typeof item === "string")
    : [];
  const next = options.find((option) => !previous.includes(option)) ?? options[previous.length % options.length] ?? "";
  collectedData[bucket] = [...previous, next].slice(-4);
  return next;
}

function getCurrentCategoryLabel(collectedData: CollectedData) {
  const category = resolveActiveCategoryLock(collectedData);
  return category ? category.replace(/\s*\(.*?\)\s*/g, "").trim() : "this category";
}

function getToneContext(collectedData: CollectedData) {
  const context: Record<string, string> = {};
  const addField = (key: string, value: unknown) => {
    if (typeof value !== "string" || !value.trim()) {
      return;
    }
    context[key] = value.trim();
  };

  addField("productType", collectedData.productType);
  addField("city", collectedData.city);
  addField("roomType", collectedData.roomType);
  addField("style", collectedData.style);
  addField("timeline", collectedData.timeline);

  return context;
}

function buildInvalidReply(currentStep: ChatStep, notes: string[]) {
  if (currentStep === ChatStep.NAME && notes.includes("name_refusal")) {
    return "No problem. Even a nickname works. What should I call you?";
  }

  if (currentStep === ChatStep.STYLE) {
    return "A rough direction is enough. Are you leaning minimal, modern, geometric, textured, or statement?";
  }

  if (currentStep === ChatStep.TIMELINE) {
    return "A rough timeline is enough. Is this for This Month, 1-3 Months, 3-6 Months, or Just Exploring?";
  }

  return ConversationHelper.getStepQuestion(currentStep);
}

function buildRedirectReply(currentStep: ChatStep, hasShownProducts: boolean, collectedData: CollectedData) {
  if (currentStep === ChatStep.COMPLETED && hasShownProducts) {
    return `${rotateCopy(collectedData, "usedRedirects", REDIRECT_OPTIONS.completed)} I can compare these, share more photos, or help with the showroom. What would you like?`;
  }

  if (currentStep === ChatStep.COMPLETED) {
    return `${rotateCopy(collectedData, "usedRedirects", REDIRECT_OPTIONS.completed)} I can help with options, comparisons, or showroom details. What would you like?`;
  }

  return buildAtomicReply(
    rotateCopy(collectedData, "usedRedirects", REDIRECT_OPTIONS.collecting),
    null,
    ConversationHelper.getStepQuestion(currentStep)
  );
}

function buildStepAcknowledgment(currentStep: ChatStep, nextStep: ChatStep, collectedData: CollectedData) {
  if (currentStep === ChatStep.NAME) {
    const name = firstName(String(collectedData.name ?? ""));
    const opening = rotateCopy(collectedData, "usedAcknowledgements", ACKNOWLEDGMENT_OPTIONS.name);
    return name ? `${opening}, ${name}.` : `${opening}.`;
  }

  if (currentStep === ChatStep.STYLE && nextStep === ChatStep.TIMELINE) {
    return `${rotateCopy(collectedData, "usedAcknowledgements", ACKNOWLEDGMENT_OPTIONS.style)}.`;
  }

  if (nextStep === ChatStep.COMPLETED) {
    return `${rotateCopy(collectedData, "usedAcknowledgements", ACKNOWLEDGMENT_OPTIONS.completed)}.`;
  }

  if (currentStep === ChatStep.BUDGET) {
    return `${rotateCopy(collectedData, "usedAcknowledgements", ACKNOWLEDGMENT_OPTIONS.budget)}.`;
  }

  if (currentStep === ChatStep.AREA || currentStep === ChatStep.ROOM_TYPE) {
    const options = currentStep === ChatStep.AREA ? ACKNOWLEDGMENT_OPTIONS.area : ACKNOWLEDGMENT_OPTIONS.room;
    return `${rotateCopy(collectedData, "usedAcknowledgements", options)}.`;
  }

  return `${rotateCopy(collectedData, "usedAcknowledgements", ACKNOWLEDGMENT_OPTIONS.generic)}.`;
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
  }): Promise<ResponsePlan> {
    const faqAnswer = params.faqResults[0]?.answer ?? null;
    const city = String(params.collectedData.city ?? "").trim();
    const categoryLabel = getCurrentCategoryLabel(params.collectedData);
    const nextQuestion = params.nextStep === ChatStep.COMPLETED ? null : ConversationHelper.getStepQuestion(params.nextStep);
    const showroomParts = splitShowroomMessage(params.showroomMsg);
    const isControlTurn =
      params.handover ||
      params.intent.intent === "PRODUCT_SWITCH" ||
      params.intent.intent === "SHOW_PRODUCTS" ||
      params.intent.intent === "MORE_IMAGES";
    let approvedReply = "";
    let reply = "";
    let allowPhrasing = false;
    let replySource: ResponsePlan["replySource"] = "deterministic";
    let validatorAccepted = false;
    let validatorUsed = false;
    let validatorReason: string | null = isControlTurn ? "call2_skipped_control_turn" : null;

    if (params.handover) {
      approvedReply = TEAM_HANDOVER_MESSAGE;
    } else if (params.intent.intent === "PRODUCT_SWITCH") {
      if (params.budgetGuard) {
        approvedReply = "Wall panels usually start around Rs 400+/sqft.\nWant me to show Breeze Blocks or Brick Cladding instead?";
      } else {
        approvedReply = params.recommendProducts.length > 0
          ? `Sure, we can switch to ${categoryLabel}. Here are a few options.`
          : `Sure, we can switch to ${categoryLabel}.`;
      }
    } else if (params.intent.intent === "SHOW_PRODUCTS") {
      if (params.recommendProducts.length > 0) {
        approvedReply = `Sure, here are a few ${categoryLabel.toLowerCase()} options.`;
      } else if (params.exhausted) {
        approvedReply = `I don't have more verified ${categoryLabel.toLowerCase()} options right now.`;
      } else {
        approvedReply = `Sure, I can show you ${categoryLabel.toLowerCase()} options.`;
      }
    } else if (params.intent.intent === "MORE_IMAGES") {
      approvedReply = params.recommendProducts.length > 0
        ? "Sure, here are more images."
        : "Sure, tell me which option you'd like to see more images of.";
    } else if (params.safetyFlags?.includes("quote_request")) {
      approvedReply = "I can share a rough range here, but not a final quote. If you'd like, I can connect you with our team for an exact quote.";
    } else if (params.safetyFlags?.includes("discount_request")) {
      approvedReply = "I can't confirm discounts here, but I can help you with the right options or connect you with our team.";
    } else if (params.intent.intent === "PURCHASE_INTENT") {
      if (!city) {
        approvedReply = "Sure. Which city should I check for you?";
      } else if (params.showroomMsg) {
        approvedReply = [
          `Yes, we have a showroom in ${city}.`,
          showroomParts.details,
          "Want the contact or should I connect you with our team?",
        ]
          .filter((item) => item && item.trim())
          .join("\n");
      } else {
        approvedReply = `I can help you take this forward in ${city}.\nWant me to connect you with our team?`;
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
        : "Of course. We can start fresh from here. Tell me the detail you'd like to change.";
    } else if (params.intent.intent === "FAQ" && faqAnswer) {
      approvedReply = params.currentStep === ChatStep.COMPLETED
        ? `${faqAnswer}\n\nWant help compare options or check a showroom?`
        : buildAtomicReply(faqAnswer, params.showroomMsg, ConversationHelper.getStepQuestion(params.currentStep));
      allowPhrasing = !params.showroomMsg;
    } else if (params.intent.intent === "FAQ") {
      approvedReply = buildRedirectReply(params.currentStep, params.collectedData.hasShownProducts === true, params.collectedData);
    } else if (params.intent.intent === "IRRELEVANT" || params.intent.intent === "SMALL_TALK") {
      approvedReply = buildRedirectReply(params.currentStep, params.collectedData.hasShownProducts === true, params.collectedData);
    } else if (params.budgetGuard) {
      approvedReply = "Wall panels usually start around Rs 400+/sqft.\nWant me to show Breeze Blocks or Brick Cladding instead?";
    } else if (params.intent.intent === "MORE_PRODUCTS" && params.exhausted) {
      approvedReply = `I've shown all my ${categoryLabel.toLowerCase()} options for now.\nWant me to compare these or explore another category?`;
    } else if (params.nextStep === ChatStep.COMPLETED && params.recommendProducts.length > 0) {
      approvedReply = "Nice, I picked a few good options for you.\nTap one and I'll help you compare.";
    } else if (params.currentStep === ChatStep.COMPLETED && params.collectedData.hasShownProducts && params.recommendProducts.length === 0) {
      approvedReply = "Want me to compare these, share more images, or help with the showroom?";
    } else if (params.intent.intent === "INVALID") {
      approvedReply = buildInvalidReply(params.currentStep, params.intent.notes);
    } else {
      approvedReply = buildAtomicReply(
        buildStepAcknowledgment(params.currentStep, params.nextStep, params.collectedData),
        params.showroomMsg,
        nextQuestion
      );
      allowPhrasing = !params.showroomMsg;
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
          recentHistory: params.recentHistory.slice(-6),
          toneContext: getToneContext(params.collectedData),
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

    return {
      reply: enforceReplyShape(reply),
      stepQuestion: nextQuestion,
      nextStep: params.nextStep,
      quickReplies: params.nextStep === ChatStep.COMPLETED ? [] : params.quickReplies,
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
