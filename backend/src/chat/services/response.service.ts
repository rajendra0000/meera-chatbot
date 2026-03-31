import { ChatStep } from "@prisma/client";
import { ConversationHelper } from "../../helpers/conversation.helper.js";
import { ChatRuntimeDeps } from "../types/chat.types.js";
import { ResponsePlan } from "../types/response.types.js";
import { IntentResult } from "../types/intent.types.js";
import { TEAM_HANDOVER_MESSAGE } from "./handover.service.js";
import { normalizeWhitespace } from "../utils/normalization.util.js";

function sanitizeReply(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
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

function buildInvalidReply(currentStep: ChatStep, notes: string[]) {
  if (currentStep === ChatStep.NAME && notes.includes("name_refusal")) {
    return "No problem. Even a nickname works. What should I call you?";
  }

  if (currentStep === ChatStep.STYLE) {
    return "A rough direction is enough. Are you leaning minimal, modern, textured, geometric, or something bold?";
  }

  return ConversationHelper.getStepQuestion(currentStep);
}

function buildRedirectReply(currentStep: ChatStep) {
  if (currentStep === ChatStep.COMPLETED) {
    return "I can help with products, pricing ranges, design ideas, or showroom details. Tell me what you'd like to explore next.";
  }

  return buildAtomicReply(
    "I'm here to help with products, pricing guidance, and design suggestions.",
    null,
    ConversationHelper.getStepQuestion(currentStep)
  );
}

export class ResponseService {
  constructor(private readonly deps: ChatRuntimeDeps) {}

  async buildPlan(params: {
    currentStep: ChatStep;
    nextStep: ChatStep;
    intent: IntentResult;
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
    const nextQuestion = params.nextStep === ChatStep.COMPLETED ? null : ConversationHelper.getStepQuestion(params.nextStep);
    let reply = "";
    let allowPhrasing = false;

    if (params.handover) {
      reply = TEAM_HANDOVER_MESSAGE;
    } else if (params.safetyFlags?.includes("quote_request")) {
      reply = "I can share a rough range here, but not a final quote. If you'd like, I can connect you with our team for an exact quote.";
    } else if (params.safetyFlags?.includes("discount_request")) {
      reply = "I can't confirm discounts here, but I can help you with the right options or connect you with our team.";
    } else if (params.intent.intent === "SECURITY_ATTACK") {
      reply = "I can help with products, pricing ranges, design guidance, or showroom details.";
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
        ? `${faqAnswer}\n\nIf you'd like, I can also help you narrow down the right design for your space.`
        : buildAtomicReply(faqAnswer, params.showroomMsg, ConversationHelper.getStepQuestion(params.currentStep));
    } else if (params.intent.intent === "FAQ") {
      reply = buildRedirectReply(params.currentStep);
    } else if (params.intent.intent === "IRRELEVANT" || params.intent.intent === "SMALL_TALK") {
      reply = buildRedirectReply(params.currentStep);
    } else if (params.budgetGuard) {
      reply = "Wall Panels usually start around Rs 400+/sqft, so this budget may fit Breeze Blocks or Brick Cladding better. I can show those for you.";
    } else if (params.intent.intent === "MORE_PRODUCTS" && params.exhausted) {
      reply = "I've already shown the closest matches here. If you want, I can help you compare them or refine the style.";
    } else if (params.nextStep === ChatStep.COMPLETED && params.recommendProducts.length > 0) {
      reply = "A few options I'd shortlist for you are below. Open any one you like, and I'll help you compare them.";
    } else if (params.intent.intent === "INVALID") {
      reply = buildInvalidReply(params.currentStep, params.intent.notes);
    } else {
      reply = buildAtomicReply("Got it.", params.showroomMsg, nextQuestion);
      allowPhrasing = true;
    }

    if (allowPhrasing) {
      try {
        const phrased = await this.deps.groqTextCompletion(
          "Rewrite the approved assistant reply as Meera. Keep it warm, concise, human, and conversational. Use 1-3 short sentences, ask at most one follow-up question, do not add facts, and return plain text only.",
          JSON.stringify(params.phrasingPayload ?? { approvedReply: reply })
        );
        if (phrased && normalizeWhitespace(phrased)) {
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
