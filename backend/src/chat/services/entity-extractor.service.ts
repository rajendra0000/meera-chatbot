import { ChatStep } from "@prisma/client";
import { QUICK_REPLIES } from "../../constants/steps.constants.js";
import { STYLE_INPUT_HINTS, TIMELINE_INPUT_HINTS, isVagueConversationValue } from "../../constants/conversation.constants.js";
import { CollectedData } from "../../types/conversation.types.js";
import { canonicalizeBudget } from "../utils/budget.util.js";
import { extractArea } from "../utils/area.util.js";
import { normalizeLower, normalizeWhitespace } from "../utils/normalization.util.js";
import { FieldUpdate, IntentResult, MutableConversationField } from "../types/intent.types.js";

const PRODUCT_KEYWORDS: Array<[string, string]> = [
  ["breeze", "Breeze Blocks"],
  ["jali", "Breeze Blocks"],
  ["mural", "Wall Murals"],
  ["brick", "Brick Cladding"],
  ["panel", "Wall Panels (H-UHPC)"],
];

const ROOM_KEYWORDS = [
  "living room",
  "bedroom",
  "office",
  "facade",
  "outdoor",
  "commercial",
  "garden",
  "compound wall",
  "lobby",
];

const NAME_PREFIX_PATTERN = /^(?:my name is|i am|i'm|im)\s+/i;
const NAME_BLOCKLIST = [
  "hello",
  "hi",
  "hey",
  "hii",
  "namaste",
  "good morning",
  "good evening",
  "developer mode",
  "system",
  "prompt",
  "instructions",
  "ignore previous instructions",
] as const;

function extractNameCandidate(message: string) {
  const trimmed = normalizeWhitespace(message);
  return trimmed.replace(NAME_PREFIX_PATTERN, "").trim();
}

function looksUnsafeNameCandidate(candidate: string) {
  const lowered = normalizeLower(candidate);
  return (
    !candidate ||
    /[<>\[\]{}]/.test(candidate) ||
    NAME_BLOCKLIST.some((pattern) => lowered.includes(pattern))
  );
}

function detectProductType(message: string) {
  const lowered = normalizeLower(message);
  for (const [keyword, value] of PRODUCT_KEYWORDS) {
    if (lowered.includes(keyword)) return value;
  }
  return null;
}

function detectCity(message: string) {
  const lowered = normalizeLower(message);
  const knownCities = QUICK_REPLIES.CITY ?? [];
  const city = knownCities.find((candidate) => lowered.includes(candidate.toLowerCase()));
  if (city && city !== "Other") return city;
  const match = lowered.match(/\bin\s+([a-z\s]+)/);
  if (match?.[1]) {
    return normalizeWhitespace(match[1]).replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return null;
}

function detectRoomType(message: string) {
  const lowered = normalizeLower(message);
  const match = ROOM_KEYWORDS.find((item) => lowered.includes(item));
  return match ? match.replace(/\b\w/g, (char) => char.toUpperCase()) : null;
}

function detectStyle(message: string) {
  const lowered = normalizeLower(message);
  const match = STYLE_INPUT_HINTS.find((item) => lowered.includes(item));
  return match ? match.replace(/\b\w/g, (char) => char.toUpperCase()) : null;
}

function detectTimeline(message: string) {
  const lowered = normalizeLower(message);
  if (TIMELINE_INPUT_HINTS.some((item) => lowered.includes(item))) {
    if (lowered.includes("this month") || lowered.includes("immediate") || lowered.includes("asap") || lowered.includes("urgent")) {
      return "This Month";
    }
    if (lowered.includes("1-3") || lowered.includes("next month") || lowered.includes("few months")) {
      return "1-3 Months";
    }
    if (lowered.includes("3-6") || lowered.includes("4-5")) {
      return "3-6 Months";
    }
    return "Just Exploring";
  }
  return null;
}

function hasBudgetSignal(message: string) {
  const lowered = normalizeLower(message);
  return (
    /\d/.test(message) ||
    message.includes("â‚¹") ||
    [
      "under",
      "below",
      "above",
      "between",
      "flexible",
      "premium",
      "affordable",
      "cheap",
      "expensive",
      "high budget",
      "low budget",
    ].some((keyword) => lowered.includes(keyword))
  );
}

function getOriginalKey(field: MutableConversationField) {
  return `_original${field.charAt(0).toUpperCase()}${field.slice(1)}` as keyof CollectedData;
}

export class EntityExtractorService {
  buildDeterministicUpdates(message: string, currentStep: ChatStep, currentData: CollectedData): FieldUpdate[] {
    const updates: FieldUpdate[] = [];
    const lowered = normalizeLower(message);
    const hasExplicitBudgetSignal = hasBudgetSignal(message);
    const allowsFlexibleBudget =
      currentStep === ChatStep.BUDGET &&
      (isVagueConversationValue(message) || ["koi bhi", "not sure", "not decided"].some((keyword) => lowered.includes(keyword)));
    const shouldKeepExistingBudget = Boolean(currentData.budget) && lowered.includes("same budget");

    if (currentStep === ChatStep.NAME) {
      const nameCandidate = extractNameCandidate(message);
      if (nameCandidate && !isVagueConversationValue(nameCandidate) && !looksUnsafeNameCandidate(nameCandidate)) {
        updates.push({ field: "name", value: nameCandidate, confidence: 0.8, source: "deterministic", overwriteMode: "if-empty" });
      }
      return updates;
    }

    const productType = detectProductType(message);
    if (productType) {
      updates.push({
        field: "productType",
        value: productType,
        confidence: 0.8,
        source: "deterministic",
        overwriteMode: currentData.productType ? "overwrite" : "if-empty",
      });
    }

    const city = detectCity(message);
    if (city) {
      updates.push({
        field: "city",
        value: city,
        confidence: 0.75,
        source: "deterministic",
        overwriteMode: currentData.city ? "overwrite" : "if-empty",
      });
    }

    if (!shouldKeepExistingBudget && (currentStep === ChatStep.BUDGET || hasExplicitBudgetSignal)) {
      const isNegative = /(^|\s)-\d+/.test(message);
      if (!isNegative) {
        const budget = canonicalizeBudget(message, isVagueConversationValue(message));
        if (budget && (budget !== "Flexible" || allowsFlexibleBudget || hasExplicitBudgetSignal)) {
          updates.push({
            field: "budget",
            value: budget,
            confidence: 0.78,
            source: "deterministic",
            overwriteMode: currentData.budget ? "overwrite" : "if-empty",
          });
        }
      }
    }

    if (currentStep === ChatStep.AREA || lowered.includes("sqft") || lowered.includes("area")) {
      const area = extractArea(message);
      if (area.area !== "Not captured" && area.area !== "0") {
        updates.push({
          field: "areaSqft",
          value: area.area,
          confidence: 0.78,
          source: "deterministic",
          overwriteMode: currentData.areaSqft ? "overwrite" : "if-empty",
        });
      }
    }

    const roomType = detectRoomType(message);
    if (roomType) {
      updates.push({
        field: "roomType",
        value: roomType,
        confidence: 0.75,
        source: "deterministic",
        overwriteMode: currentData.roomType ? "overwrite" : "if-empty",
      });
    }

    const style = detectStyle(message);
    if (style) {
      updates.push({
        field: "style",
        value: style,
        confidence: 0.72,
        source: "deterministic",
        overwriteMode: currentData.style ? "overwrite" : "if-empty",
      });
    }

    const timeline = detectTimeline(message);
    if (timeline) {
      updates.push({
        field: "timeline",
        value: timeline,
        confidence: 0.7,
        source: "deterministic",
        overwriteMode: currentData.timeline ? "overwrite" : "if-empty",
      });
    }

    return updates;
  }

  mergeUpdates(intent: IntentResult, deterministic: FieldUpdate[]) {
    const merged = [...intent.fieldUpdates];
    for (const update of deterministic) {
      if (!merged.some((candidate) => candidate.field === update.field)) {
        merged.push(update);
      }
    }
    return merged;
  }

  applyUpdates(currentData: CollectedData, updates: FieldUpdate[], currentStep: ChatStep) {
    const nextData: CollectedData = { ...currentData };
    const applied: FieldUpdate[] = [];
    const rejected: FieldUpdate[] = [];

    for (const update of updates) {
      const normalizedValue = normalizeLower(update.value);
      const looksInvalidStyle =
        update.field === "style" &&
        (isVagueConversationValue(update.value) || !STYLE_INPUT_HINTS.some((item) => normalizedValue.includes(item)));
      const looksInvalidTimeline =
        update.field === "timeline" &&
        (isVagueConversationValue(update.value) || !TIMELINE_INPUT_HINTS.some((item) => normalizedValue.includes(item)));
      const looksInvalidRoomType =
        update.field === "roomType" &&
        (isVagueConversationValue(update.value) || !ROOM_KEYWORDS.some((item) => normalizedValue.includes(item)));
      const looksInvalidArea = update.field === "areaSqft" && (!update.value.trim() || update.value === "0" || update.value === "Not captured");
      const looksInvalidName = update.field === "name" && isVagueConversationValue(update.value);

      if (looksInvalidStyle || looksInvalidTimeline || looksInvalidRoomType || looksInvalidArea || looksInvalidName) {
        rejected.push(update);
        continue;
      }

      const currentValue = nextData[update.field];
      const allowOverwrite =
        update.field !== "name" &&
        (currentStep === ChatStep.COMPLETED || update.overwriteMode === "overwrite");

      if (typeof currentValue === "string" && currentValue.trim() && !allowOverwrite) {
        rejected.push(update);
        continue;
      }

      if (allowOverwrite && typeof currentValue === "string" && currentValue.trim()) {
        const originalKey = getOriginalKey(update.field as MutableConversationField);
        if (typeof nextData[originalKey] !== "string" || !String(nextData[originalKey]).trim()) {
          nextData[originalKey] = currentValue;
        }
      }

      nextData[update.field] = update.value;
      applied.push(update);
    }

    return { collectedData: nextData, appliedUpdates: applied, rejectedUpdates: rejected };
  }
}
