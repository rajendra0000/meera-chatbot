import { ChatStep } from "@prisma/client";
import { ConversationHelper } from "../../helpers/conversation.helper.js";
import { CollectedData } from "../../types/conversation.types.js";
import { ChatRuntimeDeps } from "../types/chat.types.js";
import { ResponsePlan } from "../types/response.types.js";
import { IntentResult } from "../types/intent.types.js";
import { TEAM_HANDOVER_MESSAGE } from "./handover.service.js";
import { normalizeWhitespace } from "../utils/normalization.util.js";

const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;
const RECAP_PATTERNS = [
  "it seems",
  "it sounds like",
  "looks like",
  "so you're",
  "so you are",
  "you're looking",
  "you are looking",
] as const;

function sanitizeReply(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function hasRecapOpening(text: string) {
  const normalized = normalizeWhitespace(text).toLowerCase();
  return RECAP_PATTERNS.some((pattern) => normalized.startsWith(pattern));
}

function isAcceptablePhrasedReply(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const lineCount = trimmed.split(/\r?\n+/).filter((line) => line.trim()).length;
  const questionCount = (trimmed.match(/\?/g) ?? []).length;
  const emojiCount = (trimmed.match(EMOJI_PATTERN) ?? []).length;

  return lineCount <= 3 && questionCount <= 1 && emojiCount <= 1 && !hasRecapOpening(trimmed);
}

function buildAtomicReply(acknowledgment: string, showroomMsg: string | null, stepQuestion: string | null) {
  const firstLine = [acknowledgment, !showroomMsg ? stepQuestion : null]
    .filter((item) => item && item.trim())
    .join(" ")
    .trim();

  return [firstLine, showroomMsg, showroomMsg ? stepQuestion : null]
    .filter((item) => item && item.trim())
    .join("\n\n");
}

function firstName(name?: string) {
  return name?.trim().split(/\s+/)[0] ?? "";
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

function buildRedirectReply(currentStep: ChatStep, hasShownProducts: boolean) {
  if (currentStep === ChatStep.COMPLETED && hasShownProducts) {
    return "I can help you compare these, share more images, or help with showroom details. What would you like next?";
  }

  if (currentStep === ChatStep.COMPLETED) {
    return "I can help with options, comparisons, or showroom details. What would you like next?";
  }

  return buildAtomicReply(
    "Happy to help.",
    null,
    ConversationHelper.getStepQuestion(currentStep)
  );
}

function buildStepAcknowledgment(currentStep: ChatStep, nextStep: ChatStep, collectedData: CollectedData) {
  if (currentStep === ChatStep.NAME) {
    const name = firstName(String(collectedData.name ?? ""));
    return name ? `Nice to meet you, ${name}!` : "Nice to meet you!";
  }

  if (currentStep === ChatStep.STYLE && nextStep === ChatStep.TIMELINE) {
    return "Nice choice 😊";
  }

  if (nextStep === ChatStep.COMPLETED) {
    return "Perfect 👍";
  }

  if (currentStep === ChatStep.BUDGET) {
    return "Got it 👍";
  }

  if (currentStep === ChatStep.AREA || currentStep === ChatStep.ROOM_TYPE) {
    return "Perfect 👍";
  }

  return "Got it 👍";
}

export class ResponseService {
  constructor(private readonly deps: ChatRuntimeDeps) {}

  async buildPlan(params: {
    currentStep: ChatStep;
    nextStep: ChatStep;
    intent: IntentResult;
    collectedData: CollectedData;
    phrasingPayload?: Record<string, unknown>;
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
    const nextQuestion = params.nextStep === ChatStep.COMPLETED ? null : ConversationHelper.getStepQuestion(params.nextStep);
    let reply = "";
    let allowPhrasing = false;

    if (params.handover) {
      reply = TEAM_HANDOVER_MESSAGE;
    } else if (params.safetyFlags?.includes("quote_request")) {
      reply = "I can share a rough range here, but not a final quote. If you'd like, I can connect you with our team for an exact quote.";
    } else if (params.safetyFlags?.includes("discount_request")) {
      reply = "I can't confirm discounts here, but I can help you with the right options or connect you with our team.";
    } else if (params.intent.intent === "PURCHASE_INTENT") {
      if (!city) {
        reply = "Happy to help 👍 Which city should I check for you?";
      } else if (params.showroomMsg) {
        reply = `Perfect 👍 We have a showroom in ${city}. Would you like the details or should I connect you with our team?`;
      } else {
        reply = `Perfect 👍 I can help you take this forward in ${city}. Would you like me to connect you with our team?`;
      }
    } else if (params.intent.intent === "SECURITY_ATTACK") {
      reply = "I can help with options, design guidance, or showroom details.";
    } else if (params.intent.intent === "EMPTY") {
      reply = "I didn't catch that. Could you send it once more?";
    } else if (params.intent.intent === "SPAM") {
      reply = "I couldn't make that out clearly. Could you send it once in simple words?";
    } else if (params.intent.intent === "RESET") {
      reply = params.currentStep === ChatStep.COMPLETED
        ? "We can update any specific detail here, or start a new chat if you'd like."
        : "Of course. We can start fresh from here. Tell me the detail you'd like to change.";
    } else if (params.intent.intent === "FAQ" && faqAnswer) {
      reply = params.currentStep === ChatStep.COMPLETED
        ? `${faqAnswer}\n\nWant help compare options or check a showroom?`
        : buildAtomicReply(faqAnswer, params.showroomMsg, ConversationHelper.getStepQuestion(params.currentStep));
    } else if (params.intent.intent === "FAQ") {
      reply = buildRedirectReply(params.currentStep, params.collectedData.hasShownProducts === true);
    } else if (params.intent.intent === "IRRELEVANT" || params.intent.intent === "SMALL_TALK") {
      reply = buildRedirectReply(params.currentStep, params.collectedData.hasShownProducts === true);
    } else if (params.budgetGuard) {
      reply = "Wall panels usually start around Rs 400+/sqft. Want me to show Breeze Blocks or Brick Cladding instead?";
    } else if (params.intent.intent === "MORE_PRODUCTS" && params.exhausted) {
      reply = "I've already shared the closest matches. Want me to compare them or help with the next step?";
    } else if (params.nextStep === ChatStep.COMPLETED && params.recommendProducts.length > 0) {
      reply = "Nice, I've picked a few options for you. Tap one and I'll help you compare.";
    } else if (params.currentStep === ChatStep.COMPLETED && params.collectedData.hasShownProducts && params.recommendProducts.length === 0) {
      reply = "Want me to compare these, share more images, or help with the showroom?";
    } else if (params.intent.intent === "INVALID") {
      reply = buildInvalidReply(params.currentStep, params.intent.notes);
    } else {
      reply = buildAtomicReply(
        buildStepAcknowledgment(params.currentStep, params.nextStep, params.collectedData),
        params.showroomMsg,
        nextQuestion
      );
      allowPhrasing = !params.showroomMsg;
    }

    if (allowPhrasing) {
      try {
        const phrasingPayload = {
          approvedReply: reply,
          ...(params.phrasingPayload ?? {}),
        };
        const phrased = await this.deps.groqTextCompletion(
          "Rewrite the approved assistant reply as Meera. Keep it warm, concise, human, and conversational. Use 1-3 short sentences, ask at most one follow-up question, do not add facts, and return plain text only.",
          JSON.stringify(phrasingPayload)
        );
        if (phrased && isAcceptablePhrasedReply(phrased)) {
          reply = normalizeWhitespace(phrased);
        }
      } catch {
        // Use deterministic reply
      }
    }

    return {
      reply: sanitizeReply(reply),
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
    };
  }
}
