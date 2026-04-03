import { ChatStep } from "@prisma/client";
import { Product } from "../../types/chat.types.js";
import { CollectedData } from "../../types/conversation.types.js";
import { ResponseValidationResult } from "../types/response.types.js";
import { ChatRuntimeDeps } from "../types/chat.types.js";
import { IntentResult } from "../types/intent.types.js";
import { normalizeLower, normalizeWhitespace } from "../utils/normalization.util.js";
import { resolveActiveCategoryLock } from "./product.service.js";

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
const IMAGE_TERMS = ["image", "images", "photo", "photos", "picture", "pictures", "pic", "pics"] as const;
const PRODUCT_TERMS = ["option", "options", "product", "products", "design", "designs", "catalog"] as const;
const HANDOVER_TERMS = ["kabir", "team", "human", "agent", "connect", "callback", "call"] as const;
const SHOWROOM_TERMS = ["showroom", "dealer", "store", "visit", "contact", "location"] as const;
const FILLER_ONLY_PATTERNS = [
  "sounds good",
  "that helps narrow it down",
  "based on your preferences",
  "let's continue",
  "happy to help",
  "sure",
  "got it",
  "okay",
  "perfect",
  "makes sense",
  "good to know",
  "that helps",
  "nice",
  "of course",
];

const VALIDATOR_PROMPT =
  "You are a strict reply validator for a WhatsApp sales chatbot. The BACKEND_APPROVED_REPLY is the source of truth. Judge ONLY whether the CANDIDATE_REPLY stays faithful to it, matches the user's latest message, fits the recent conversation, and does not add facts or ask a different question. Answer ONLY YES or NO.";

type QuestionTopic =
  | "name"
  | "productType"
  | "city"
  | "budget"
  | "areaSqft"
  | "roomType"
  | "style"
  | "timeline"
  | "handover"
  | "showroom"
  | "images"
  | "products"
  | "unknown";

type ValidationInput = {
  userMessage: string;
  recentHistory: string[];
  intent: IntentResult;
  currentStep: ChatStep;
  approvedReply: string;
  candidateReply: string;
  recommendProducts: Product[];
  handover: boolean;
  showroomMsg: string | null;
  collectedData: CollectedData;
};

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

function removeRecapOpening(text: string) {
  const normalized = text.trim();
  if (!hasRecapOpening(normalized)) {
    return normalized;
  }

  const punctuationIndex = normalized.search(/[.!?]/);
  if (punctuationIndex >= 0 && punctuationIndex < normalized.length - 1) {
    return normalized.slice(punctuationIndex + 1).trim();
  }

  return normalized;
}

export function isAcceptableReplyShape(text: string) {
  const trimmed = removeRecapOpening(text.trim());
  if (!trimmed) return false;

  const lineCount = trimmed.split(/\r?\n+/).filter((line) => line.trim()).length;
  const questionCount = (trimmed.match(/\?/g) ?? []).length;
  const emojiCount = (trimmed.match(EMOJI_PATTERN) ?? []).length;

  return lineCount <= 3 && questionCount <= 1 && emojiCount <= 1 && !hasRecapOpening(trimmed);
}

export function enforceReplyShape(text: string) {
  const cleaned = removeRecapOpening(sanitizeReply(text));
  if (!cleaned) return cleaned;

  const lines = cleaned
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);

  let reply = lines.join("\n");
  const firstQuestionIndex = reply.indexOf("?");
  if (firstQuestionIndex >= 0) {
    reply =
      reply.slice(0, firstQuestionIndex + 1) +
      reply
        .slice(firstQuestionIndex + 1)
        .replace(/\?/g, ".");
  }

  return reply.trim();
}

function normalizeReplyCandidate(text: string) {
  return enforceReplyShape(normalizeWhitespace(text));
}

function extractPrimaryQuestion(text: string) {
  const matches = text.match(/[^?]+\?/g);
  if (!matches || matches.length === 0) {
    return null;
  }

  return matches[matches.length - 1]?.trim() ?? null;
}

function detectQuestionTopic(text: string | null): QuestionTopic {
  if (!text) {
    return "unknown";
  }

  const lowered = normalizeLower(text);
  if (lowered.includes("call you") || lowered.includes("your name")) return "name";
  if (
    lowered.includes("exploring today") ||
    lowered.includes("wall panels") ||
    lowered.includes("wall murals") ||
    lowered.includes("breeze blocks") ||
    lowered.includes("brick cladding") ||
    lowered.includes("category")
  ) {
    return "productType";
  }
  if (lowered.includes("which city") || lowered.includes("what city") || lowered.includes("city should i check")) return "city";
  if (lowered.includes("budget") || lowered.includes("price range") || lowered.includes("/sqft") || lowered.includes("per sqft")) return "budget";
  if (lowered.includes("area") || lowered.includes("sqft") || lowered.includes("cover") || lowered.includes("wall size")) return "areaSqft";
  if (lowered.includes("room") || lowered.includes("space") || lowered.includes("living room") || lowered.includes("bedroom")) return "roomType";
  if (lowered.includes("style") || lowered.includes("leaning") || lowered.includes("modern") || lowered.includes("minimal") || lowered.includes("textured")) return "style";
  if (lowered.includes("timeline") || lowered.includes("planning") || lowered.includes("this month") || lowered.includes("1-3 months")) return "timeline";
  if (lowered.includes("team") || lowered.includes("connect") || lowered.includes("kabir")) return "handover";
  if (lowered.includes("showroom") || lowered.includes("contact")) return "showroom";
  if (IMAGE_TERMS.some((term) => lowered.includes(term))) return "images";
  if (PRODUCT_TERMS.some((term) => lowered.includes(term))) return "products";
  return "unknown";
}

function tokenize(text: string) {
  return normalizeLower(text)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function shareMeaningfulQuestionIntent(a: string, b: string) {
  const topicA = detectQuestionTopic(a);
  const topicB = detectQuestionTopic(b);
  if (topicA !== "unknown" && topicB !== "unknown") {
    return topicA === topicB;
  }

  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  const overlap = [...tokensA].filter((token) => tokensB.has(token)).length;
  return overlap > 0 && overlap >= Math.min(tokensA.size, tokensB.size) / 2;
}

function getRecentAssistantQuestions(history: string[]) {
  return history
    .filter((item) => normalizeLower(item).startsWith("assistant:"))
    .map((item) => item.replace(/^assistant:\s*/i, "").trim())
    .map((item) => extractPrimaryQuestion(item))
    .filter((item): item is string => Boolean(item))
    .slice(-2);
}

function collectSignals(text: string, recommendProducts: Product[], collectedData: CollectedData) {
  const lowered = normalizeLower(text);
  const signals = new Set<string>();
  const topic = detectQuestionTopic(text);
  if (topic !== "unknown") {
    signals.add(topic);
  }
  if (IMAGE_TERMS.some((term) => lowered.includes(term))) {
    signals.add("images");
  }
  if (PRODUCT_TERMS.some((term) => lowered.includes(term))) {
    signals.add("products");
  }
  if (HANDOVER_TERMS.some((term) => lowered.includes(term))) {
    signals.add("handover");
  }
  if (SHOWROOM_TERMS.some((term) => lowered.includes(term))) {
    signals.add("showroom");
  }

  const category = resolveActiveCategoryLock(collectedData) ?? String(collectedData.productType ?? "");
  const categoryLower = normalizeLower(category);
  if (categoryLower.includes("wall panel") && lowered.includes("wall panel")) signals.add("wall_panels");
  if (categoryLower.includes("wall mural") && lowered.includes("wall mural")) signals.add("wall_murals");
  if (categoryLower.includes("breeze") && lowered.includes("breeze")) signals.add("breeze_blocks");
  if (categoryLower.includes("brick") && lowered.includes("brick")) signals.add("brick_cladding");

  for (const product of recommendProducts) {
    if (normalizeLower(text).includes(normalizeLower(product.name))) {
      signals.add(`product:${normalizeLower(product.name)}`);
    }
  }

  return signals;
}

function isMostlyFiller(text: string) {
  const lowered = normalizeLower(text).replace(/[.!?]/g, "").trim();
  if (!lowered) {
    return true;
  }

  return FILLER_ONLY_PATTERNS.some((pattern) => lowered === pattern || lowered === `${pattern} please`);
}

function normalizeNumberToken(token: string) {
  return token.replace(/\s+/g, "").toLowerCase();
}

function extractNumberTokens(text: string) {
  return new Set(
    (text.match(/(?:₹|rs\.?\s*)?\d+(?:\s*-\s*\d+)?(?:\+)?/gi) ?? []).map((token) => normalizeNumberToken(token))
  );
}

function reject(reply: string, reason: string, usedLlmCheck: boolean): ResponseValidationResult {
  return {
    accepted: false,
    reason,
    usedLlmCheck,
    source: "fallback_approved",
    reply,
  };
}

function accept(reply: string, usedLlmCheck: boolean): ResponseValidationResult {
  return {
    accepted: true,
    reason: null,
    usedLlmCheck,
    source: "phrased",
    reply,
  };
}

export class ResponseValidatorService {
  constructor(private readonly deps: Pick<ChatRuntimeDeps, "groqTextCompletion">) {}

  async validatePolishedReply(params: ValidationInput): Promise<ResponseValidationResult> {
    const candidate = normalizeReplyCandidate(params.candidateReply);
    const approvedReply = enforceReplyShape(params.approvedReply);

    if (!candidate) {
      return reject(approvedReply, "empty_candidate", false);
    }

    if (!isAcceptableReplyShape(candidate)) {
      return reject(approvedReply, "shape_invalid", false);
    }

    if (params.handover) {
      const candidateTopic = detectQuestionTopic(candidate);
      if (
        candidate.includes("?") ||
        ["name", "productType", "city", "budget", "areaSqft", "roomType", "style", "timeline"].includes(candidateTopic)
      ) {
        return reject(approvedReply, "handover_followup_blocked", false);
      }
    }

    const approvedQuestion = extractPrimaryQuestion(approvedReply);
    const candidateQuestion = extractPrimaryQuestion(candidate);

    if (Boolean(approvedQuestion) !== Boolean(candidateQuestion)) {
      return reject(approvedReply, "question_presence_changed", false);
    }

    if (approvedQuestion && candidateQuestion && !shareMeaningfulQuestionIntent(approvedQuestion, candidateQuestion)) {
      return reject(approvedReply, "question_intent_changed", false);
    }

    const recentQuestions = getRecentAssistantQuestions(params.recentHistory);
    if (candidateQuestion && recentQuestions.some((question) => shareMeaningfulQuestionIntent(question, candidateQuestion))) {
      return reject(approvedReply, "repeated_question", false);
    }

    const userSignals = collectSignals(params.userMessage, params.recommendProducts, params.collectedData);
    const approvedSignals = collectSignals(approvedReply, params.recommendProducts, params.collectedData);
    const candidateSignals = collectSignals(candidate, params.recommendProducts, params.collectedData);

    if (userSignals.has("images") && !candidateSignals.has("images") && !candidateSignals.has("products")) {
      return reject(approvedReply, "image_request_ignored", false);
    }

    if (params.intent.intent === "HANDOVER" && !candidateSignals.has("handover")) {
      return reject(approvedReply, "handover_not_acknowledged", false);
    }

    if (params.intent.intent === "PRODUCT_SWITCH") {
      const hasCategoryMention =
        candidateSignals.has("wall_panels") ||
        candidateSignals.has("wall_murals") ||
        candidateSignals.has("breeze_blocks") ||
        candidateSignals.has("brick_cladding") ||
        params.recommendProducts.some((product) => normalizeLower(candidate).includes(normalizeLower(product.name)));
      if (!hasCategoryMention) {
        return reject(approvedReply, "product_switch_not_acknowledged", false);
      }
    }

    if (approvedSignals.size > 0) {
      const overlap = [...approvedSignals].filter((signal) => candidateSignals.has(signal));
      if (overlap.length === 0 && !candidateQuestion) {
        return reject(approvedReply, "generic_or_unrelated", false);
      }
    }

    if (isMostlyFiller(candidate) && approvedSignals.size > 0) {
      return reject(approvedReply, "generic_or_unrelated", false);
    }

    const allowedNumbers = new Set<string>([
      ...extractNumberTokens(approvedReply),
      ...extractNumberTokens(params.showroomMsg ?? ""),
    ]);
    const candidateNumbers = extractNumberTokens(candidate);
    if ([...candidateNumbers].some((token) => !allowedNumbers.has(token))) {
      return reject(approvedReply, "unsupported_numeric_fact", false);
    }

    const mentionsShowroom = SHOWROOM_TERMS.some((term) => normalizeLower(candidate).includes(term));
    const showroomAllowed =
      SHOWROOM_TERMS.some((term) => normalizeLower(approvedReply).includes(term)) ||
      SHOWROOM_TERMS.some((term) => normalizeLower(params.showroomMsg ?? "").includes(term));
    if (mentionsShowroom && !showroomAllowed) {
      return reject(approvedReply, "unsupported_showroom_claim", false);
    }

    try {
      const validationReply = await this.deps.groqTextCompletion(
        VALIDATOR_PROMPT,
        JSON.stringify({
          USER_MESSAGE: params.userMessage,
          RECENT_HISTORY: params.recentHistory.slice(-6),
          CURRENT_STEP: params.currentStep,
          INTENT: params.intent.intent,
          BACKEND_APPROVED_REPLY: approvedReply,
          CANDIDATE_REPLY: candidate,
        })
      );
      const verdict = normalizeLower(String(validationReply ?? "").trim());
      if (verdict === "yes") {
        return accept(candidate, true);
      }
      return reject(approvedReply, verdict === "no" ? "llm_validator_rejected" : "llm_validator_malformed", true);
    } catch {
      return reject(approvedReply, "llm_validator_error", true);
    }
  }
}
