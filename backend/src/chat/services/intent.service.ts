import { ChatStep } from "@prisma/client";
import { fallbackRouter } from "../../services/router.service.js";
import { CALL1_SYSTEM_PROMPT, SYSTEM_PROMPT_CONTENT } from "../../services/prompt.service.js";
import { CollectedData } from "../../types/conversation.types.js";
import { ChatRuntimeDeps } from "../types/chat.types.js";
import { ExtractableConversationField, IntentResult } from "../types/intent.types.js";
import { normalizeLower, normalizeWhitespace } from "../utils/normalization.util.js";

const DOMAIN_KEYWORDS = [
  "hey concrete",
  "concrete",
  "panel",
  "panels",
  "mural",
  "murals",
  "breeze",
  "block",
  "blocks",
  "brick",
  "cladding",
  "product",
  "products",
  "design",
  "showroom",
  "pricing",
  "price",
  "budget",
  "sqft",
  "area",
  "room",
  "style",
  "timeline",
  "installation",
  "delivery",
  "catalog",
  "sample",
  "texture",
  "wall",
  "facade",
  "quote",
  "warranty",
  "greenpro",
] as const;

const CONTEXT_HINTS = [
  "modern",
  "minimal",
  "bold",
  "geometric",
  "textured",
  "home",
  "house",
  "space",
  "interior",
  "exterior",
  "outdoor",
  "living",
  "bedroom",
  "office",
  "lobby",
  "facade",
  "residential",
  "commercial",
  "affordable",
  "premium",
  "luxury",
  "asap",
  "urgent",
  "exploring",
  "renovation",
  "renovating",
  "project",
] as const;

const PURCHASE_INTENT_PATTERNS = [
  "where to buy",
  "how can i purchase",
  "how do i purchase",
  "how to proceed",
  "how do i proceed",
  "want to buy",
  "want to purchase",
  "ready to order",
  "place order",
  "place an order",
  "book order",
  "visit showroom",
  "showroom",
  "purchase",
  "order",
  "buy",
  "visit",
] as const;

function hasDomainSignal(message: string) {
  const lowered = normalizeLower(message);
  return DOMAIN_KEYWORDS.some((keyword) => lowered.includes(keyword));
}

function hasContextHint(message: string) {
  const lowered = normalizeLower(message);
  return CONTEXT_HINTS.some((keyword) => lowered.includes(keyword));
}

function hasRelevantHint(message: string) {
  return hasDomainSignal(message) || hasContextHint(message);
}

function detectPurchaseIntent(message: string) {
  const lowered = normalizeLower(message);
  return PURCHASE_INTENT_PATTERNS.some((pattern) => lowered.includes(pattern));
}

function inferIntentConfidence(messageType: string | null, fieldUpdateCount: number, rawConfidence: unknown) {
  if (typeof rawConfidence === "number" && Number.isFinite(rawConfidence)) {
    return Math.max(0, Math.min(1, rawConfidence));
  }

  switch (messageType) {
    case "STEP_ANSWER":
      return fieldUpdateCount > 0 ? 0.82 : 0.68;
    case "FAQ_QUESTION":
      return 0.72;
    case "SHOW_PRODUCTS":
    case "MORE_PRODUCTS":
    case "MORE_IMAGES":
      return 0.85;
    case "HANDOVER_REQUEST":
      return 0.9;
    case "GREETING":
      return 0.75;
    case "FREE_CHAT_REPLY":
      return fieldUpdateCount > 0 ? 0.74 : 0.45;
    case "VAGUE":
      return fieldUpdateCount > 0 ? 0.58 : 0.35;
    case "NAME_REFUSAL":
      return 0.9;
    default:
      return 0.5;
  }
}

function shouldMarkIrrelevant(message: string, result: IntentResult) {
  if (result.fieldUpdates.length > 0) {
    return false;
  }

  if (
    result.intent === "HANDOVER" ||
    result.intent === "PURCHASE_INTENT" ||
    result.intent === "RESET" ||
    result.intent === "SKIP" ||
    result.intent === "GREETING"
  ) {
    return false;
  }

  if (hasRelevantHint(message)) {
    return false;
  }

  if (result.intent === "FAQ") {
    return true;
  }

  if (result.intent === "STEP_ANSWER") {
    return result.confidence < 0.65;
  }

  if (result.intent === "SMALL_TALK") {
    return result.confidence < 0.55;
  }

  return false;
}

function normalizeRelevance(message: string, currentStep: ChatStep, result: IntentResult) {
  if (result.intent === "PURCHASE_INTENT") {
    return result;
  }

  if (result.intent === "SMALL_TALK" && currentStep !== ChatStep.COMPLETED && hasRelevantHint(message)) {
    result.intent = "STEP_ANSWER";
    result.confidence = Math.max(result.confidence, 0.6);
    return result;
  }

  if (shouldMarkIrrelevant(message, result)) {
    result.intent = "IRRELEVANT";
  }

  return result;
}

function inferFieldFromStep(step: ChatStep) {
  switch (step) {
    case ChatStep.NAME:
      return "name";
    case ChatStep.PRODUCT_TYPE:
      return "productType";
    case ChatStep.CITY:
      return "city";
    case ChatStep.BUDGET:
      return "budget";
    case ChatStep.AREA:
      return "areaSqft";
    case ChatStep.ROOM_TYPE:
      return "roomType";
    case ChatStep.STYLE:
      return "style";
    case ChatStep.TIMELINE:
      return "timeline";
    default:
      return null;
  }
}

function toIntentResult(partial: Partial<IntentResult>): IntentResult {
  return {
    intent: partial.intent ?? "INVALID",
    confidence: partial.confidence ?? 0.5,
    fieldUpdates: partial.fieldUpdates ?? [],
    browseOnly: partial.browseOnly ?? false,
    handover: partial.handover ?? false,
    fallbackUsed: partial.fallbackUsed ?? false,
    llmFailures: partial.llmFailures ?? [],
    notes: partial.notes ?? [],
  };
}

function parseLegacyIntent(raw: unknown, currentStep: ChatStep): IntentResult | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const extractedData = Array.isArray(candidate.extractedData) ? candidate.extractedData : [];
  const extractedField =
    typeof candidate.extractedField === "string"
      ? candidate.extractedField
      : inferFieldFromStep(currentStep);
  const extractedValue = typeof candidate.extractedValue === "string" ? candidate.extractedValue : null;
  const switchIntent = typeof candidate.switchIntent === "string" ? candidate.switchIntent : null;
  const messageType = typeof candidate.messageType === "string" ? candidate.messageType : null;
  const confidence = inferIntentConfidence(messageType, extractedData.length, candidate.confidence);
  const normalizeField = (field: string): ExtractableConversationField | null => {
    const normalized = field === "area" ? "areaSqft" : field;
    if (["name", "productType", "city", "budget", "areaSqft", "roomType", "style", "timeline"].includes(normalized)) {
      return normalized as ExtractableConversationField;
    }
    return null;
  };

  const fieldUpdates = extractedData
    .filter((item): item is { field: string; value: string } =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as { field?: unknown }).field === "string" &&
      typeof (item as { value?: unknown }).value === "string"
    )
    .map((item) => {
      const field = normalizeField(item.field);
      return field
        ? {
            field,
            value: item.value,
            confidence: 0.8,
            source: "llm" as const,
            overwriteMode: switchIntent ? "overwrite" as const : "if-empty" as const,
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const normalizedExtractedField = extractedField ? normalizeField(extractedField) : null;
  if (normalizedExtractedField && extractedValue && !fieldUpdates.some((item) => item.field === normalizedExtractedField)) {
    fieldUpdates.push({
      field: normalizedExtractedField,
      value: extractedValue,
      confidence: 0.7,
      source: "llm",
      overwriteMode: switchIntent ? "overwrite" : "if-empty",
    });
  }

  const browseOnly = switchIntent === "BROWSING";

  switch (messageType) {
    case "STEP_ANSWER":
      return toIntentResult({
        intent: currentStep === ChatStep.COMPLETED ? "FIELD_UPDATE" : "STEP_ANSWER",
        confidence,
        fieldUpdates,
        browseOnly,
      });
    case "FAQ_QUESTION":
      return toIntentResult({ intent: "FAQ", confidence, fieldUpdates, browseOnly });
    case "SHOW_PRODUCTS":
      return toIntentResult({ intent: "SHOW_PRODUCTS", confidence, fieldUpdates, browseOnly });
    case "MORE_PRODUCTS":
      return toIntentResult({ intent: "MORE_PRODUCTS", confidence, fieldUpdates, browseOnly });
    case "MORE_IMAGES":
      return toIntentResult({ intent: "MORE_IMAGES", confidence, fieldUpdates, browseOnly });
    case "HANDOVER_REQUEST":
      return toIntentResult({ intent: "HANDOVER", confidence, fieldUpdates, browseOnly, handover: true });
    case "GREETING":
      return toIntentResult({ intent: "GREETING", confidence, fieldUpdates, browseOnly });
    case "FREE_CHAT_REPLY":
      return toIntentResult({
        intent: fieldUpdates.length > 0 ? "FIELD_UPDATE" : "SMALL_TALK",
        confidence,
        fieldUpdates,
        browseOnly,
      });
    case "VAGUE":
      return toIntentResult({
        intent: currentStep === ChatStep.BUDGET && fieldUpdates.some((item) => item.field === "budget") ? "STEP_ANSWER" : "INVALID",
        confidence,
        fieldUpdates,
        browseOnly,
      });
    case "NAME_REFUSAL":
      return toIntentResult({ intent: "INVALID", confidence, fieldUpdates: [], notes: ["name_refusal"], browseOnly: false });
    default:
      return null;
  }
}

function fallbackIntent(message: string, currentStep: ChatStep, currentData: CollectedData): IntentResult {
  const lowered = normalizeLower(message);
  const routed = fallbackRouter(message, currentStep);

  if (currentStep === ChatStep.NAME && ["skip", "why", "kyu", "no", "nahi", "nhi", "ni"].some((pattern) => lowered.includes(pattern))) {
    if (Number(currentData.nameRetryCount ?? 0) >= 1) {
      return toIntentResult({
        intent: "STEP_ANSWER",
        confidence: 0.85,
        fieldUpdates: [{ field: "name", value: "Friend", confidence: 1, source: "deterministic", overwriteMode: "if-empty" }],
        fallbackUsed: true,
        notes: ["name_fallback"],
      });
    }

    return toIntentResult({
      intent: "INVALID",
      confidence: 0.9,
      fieldUpdates: [],
      fallbackUsed: true,
      notes: ["name_refusal"],
    });
  }

  if (lowered.includes("reset")) {
    return toIntentResult({ intent: "RESET", confidence: 0.95, fallbackUsed: true });
  }

  if (lowered.includes("skip")) {
    return toIntentResult({ intent: "SKIP", confidence: 0.95, fallbackUsed: true });
  }

  if (detectPurchaseIntent(message)) {
    return toIntentResult({ intent: "PURCHASE_INTENT", confidence: 0.96, fallbackUsed: true });
  }

  if (["more images", "more photos", "more pictures", "more image", "more photo"].some((pattern) => lowered.includes(pattern))) {
    return toIntentResult({ intent: "MORE_IMAGES", confidence: 0.9, fallbackUsed: true });
  }

  if (["more products", "more options", "more designs", "what else", "more choices"].some((pattern) => lowered.includes(pattern))) {
    return toIntentResult({ intent: "MORE_PRODUCTS", confidence: 0.9, fallbackUsed: true });
  }

  if (routed.type === "FAQ_QUESTION") {
    return toIntentResult({ intent: "FAQ", confidence: 0.45, fallbackUsed: true });
  }

  if (routed.type === "GREETING") {
    return toIntentResult({ intent: "GREETING", confidence: 0.75, fallbackUsed: true });
  }

  if (routed.type === "SHOW_PRODUCTS") {
    return toIntentResult({ intent: "SHOW_PRODUCTS", confidence: 0.8, fallbackUsed: true });
  }

  if (routed.type === "VAGUE") {
    return toIntentResult({ intent: "INVALID", confidence: 0.35, fallbackUsed: true });
  }

  return toIntentResult({
    intent: currentStep === ChatStep.COMPLETED ? "FIELD_UPDATE" : "STEP_ANSWER",
    confidence: 0.55,
    fallbackUsed: true,
  });
}

export class IntentService {
  constructor(private readonly deps: ChatRuntimeDeps) {}

  async classify(params: {
    message: string;
    currentStep: ChatStep;
    currentData: CollectedData;
    forcedIntent?: "EMPTY" | "SPAM" | "SECURITY_ATTACK" | null;
    handoverRequested?: boolean;
  }): Promise<IntentResult> {
    if (params.handoverRequested) {
      return toIntentResult({ intent: "HANDOVER", handover: true });
    }

    if (params.forcedIntent) {
      return toIntentResult({ intent: params.forcedIntent, handover: false, fallbackUsed: true });
    }

    if (detectPurchaseIntent(params.message)) {
      return toIntentResult({ intent: "PURCHASE_INTENT", confidence: 0.96, fallbackUsed: true });
    }

    const llmFailures: string[] = [];
    const payload = JSON.stringify({
      USER_MESSAGE: normalizeWhitespace(params.message),
      CURRENT_STEP: params.currentStep,
      COLLECTED_DATA: params.currentData,
    });

    try {
      const completion = await this.deps.groqJsonCompletion(CALL1_SYSTEM_PROMPT, payload);
      if (!completion) {
        throw new Error("Call 1 returned null");
      }
      const parsed = parseLegacyIntent(JSON.parse(completion), params.currentStep);
      if (parsed) {
        normalizeRelevance(params.message, params.currentStep, parsed);
        parsed.llmFailures = llmFailures;
        return parsed;
      }
      throw new Error("Call 1 schema invalid");
    } catch (error) {
      llmFailures.push(error instanceof Error ? error.message : "call1_failed");
    }

    try {
      const completion = await this.deps.groqJsonCompletion(
        SYSTEM_PROMPT_CONTENT,
        `User message: "${normalizeWhitespace(params.message)}"`
      );
      if (!completion) {
        throw new Error("legacy fallback returned null");
      }
      const parsed = parseLegacyIntent(JSON.parse(completion), params.currentStep);
      if (parsed) {
        normalizeRelevance(params.message, params.currentStep, parsed);
        parsed.fallbackUsed = true;
        parsed.llmFailures = llmFailures;
        return parsed;
      }
      throw new Error("legacy fallback schema invalid");
    } catch (error) {
      llmFailures.push(error instanceof Error ? error.message : "legacy_fallback_failed");
    }

    const deterministic = fallbackIntent(params.message, params.currentStep, params.currentData);
    normalizeRelevance(params.message, params.currentStep, deterministic);
    deterministic.llmFailures = llmFailures;
    return deterministic;
  }
}
