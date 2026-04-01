import { LeadStatus } from "@prisma/client";
import { SCORE_THRESHOLDS, TIMELINE_SCORE_BY_LABEL } from "../constants/score.constants.js";
import { normalizeTimelineValue } from "../constants/conversation.constants.js";
import { ConversationHelper } from "./conversation.helper.js";
import { CollectedData } from "../types/conversation.types.js";
import { ScoreBreakdown } from "../types/lead.types.js";

type BudgetBand = "under-200" | "200-400" | "400-plus" | "flexible" | "unknown";
type ProductCategory = "wall-panels" | "wall-murals" | "brick-cladding" | "breeze-blocks" | "unknown";

const SUGGESTION_INTENT_KEYWORDS = [
  "suggest",
  "recommend",
  "show me",
  "show options",
  "products",
  "options",
  "designs",
  "shortlist",
];

const VISUAL_INTENT_KEYWORDS = [
  "image",
  "images",
  "photo",
  "photos",
  "picture",
  "pictures",
  "compare",
  "comparison",
  "difference",
  "more images",
];

const PURCHASE_INTENT_KEYWORDS = [
  "buy",
  "purchase",
  "order",
  "finalize",
  "visit",
  "showroom",
  "book",
  "where should i visit",
  "where can i visit",
];

const LOW_SIGNAL_MESSAGES = new Set([
  "ok",
  "okay",
  "kk",
  "hmm",
  "hmmm",
  "yes",
  "no",
  "fine",
  "haan",
  "han",
  "sure",
  "cool",
]);

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export class ScoreHelper {
  private static normalizeBudgetBand(value: string): BudgetBand {
    const normalized = normalizeText(value)
      .replace(/[₹â‚¹Ã¢â€šÂ¹]/g, "")
      .replace(/\/(sqft|sq\.?ft|piece|set)/g, "")
      .trim();

    if (!normalized) return "unknown";
    if (normalized.includes("flexible")) return "flexible";
    if (normalized.includes("under") || normalized.includes("below") || normalized.includes("less than")) return "under-200";
    if (normalized.includes("200-400") || normalized.includes("200 to 400") || normalized.includes("200 400")) return "200-400";
    if (normalized.includes("400+") || normalized.includes("above 400") || normalized.includes("over 400")) return "400-plus";

    const numbers = normalized.match(/\d+/g)?.map((item) => Number(item)) ?? [];
    if (numbers.length >= 2 && numbers[0] <= 200 && numbers[1] >= 400) return "200-400";
    const firstNumber = numbers[0] ?? 0;
    if (firstNumber <= 0) return "unknown";
    if (firstNumber <= 200) return "under-200";
    if (firstNumber <= 400) return "200-400";
    return "400-plus";
  }

  private static normalizeProductCategory(value: string): ProductCategory {
    const normalized = normalizeText(value);
    if (!normalized) return "unknown";
    if (normalized.includes("breeze") || normalized.includes("jali")) return "breeze-blocks";
    if (normalized.includes("mural")) return "wall-murals";
    if (normalized.includes("brick")) return "brick-cladding";
    if (normalized.includes("panel")) return "wall-panels";
    return "unknown";
  }

  private static inferCategoryFromRecommendation(recommendedProducts: Array<{ priceRange: string }>): ProductCategory {
    const band = ScoreHelper.normalizeBudgetBand(recommendedProducts[0]?.priceRange ?? "");
    if (band === "400-plus") return "wall-panels";
    if (band === "200-400") return "brick-cladding";
    return "unknown";
  }

  private static scoreBudgetAlignment(
    productType: string,
    budget: string,
    recommendedProducts: Array<{ priceRange: string }>
  ) {
    const budgetBand = ScoreHelper.normalizeBudgetBand(budget);
    if (budgetBand === "unknown") return 0;

    const category =
      ScoreHelper.normalizeProductCategory(productType) !== "unknown"
        ? ScoreHelper.normalizeProductCategory(productType)
        : ScoreHelper.inferCategoryFromRecommendation(recommendedProducts);

    if (category === "wall-panels" || category === "wall-murals") {
      if (budgetBand === "400-plus") return 30;
      if (budgetBand === "flexible") return 24;
      if (budgetBand === "200-400") return 14;
      return 4;
    }

    if (category === "brick-cladding") {
      if (budgetBand === "200-400") return 30;
      if (budgetBand === "400-plus") return 24;
      if (budgetBand === "flexible") return 20;
      return 8;
    }

    if (category === "breeze-blocks") {
      if (budgetBand === "200-400") return 28;
      if (budgetBand === "under-200") return 22;
      if (budgetBand === "400-plus") return 20;
      if (budgetBand === "flexible") return 18;
      return 8;
    }

    if (budgetBand === "flexible") return 16;
    return ScoreHelper.normalizeBudgetBand(recommendedProducts[0]?.priceRange ?? "") === budgetBand ? 24 : 12;
  }

  private static scoreSpace(areaValue: string) {
    const normalized = normalizeText(areaValue);
    if (!normalized || normalized === "not captured" || normalized === "unknown") return 0;

    if (/^\d+$/.test(normalized)) {
      const sqft = Number(normalized);
      if (sqft >= 150 && sqft <= 400) return 20;
      if (sqft >= 80 && sqft < 150) return 18;
      if (sqft > 400 && sqft <= 1000) return 18;
      if (sqft >= 50 && sqft < 80) return 15;
      if (sqft > 1000) return 16;
      return 10;
    }

    if (normalized === "100-300" || normalized === "medium") return 16;
    if (normalized === "300+" || normalized === "large") return 15;
    if (normalized === "<100" || normalized === "small") return 10;

    const fallbackNumber = Number(normalized.match(/\d+/)?.[0] ?? "0");
    if (fallbackNumber >= 150) return 18;
    if (fallbackNumber >= 50) return 14;
    return 0;
  }

  private static normalizeTimelineLabel(collectedData: CollectedData) {
    const rawTimeline = String(collectedData.timeline ?? "").trim();
    if (rawTimeline) {
      const normalizedTimeline = normalizeTimelineValue(rawTimeline);
      if (normalizedTimeline) return normalizedTimeline;
    }

    const timelineScore = Number(collectedData.timelineScore ?? 0);
    if (timelineScore === 10) return "This Month";
    if (timelineScore === 8) return "1-3 Months";
    if (timelineScore === 5) return "3-6 Months";
    if (timelineScore === 2) return "Just Exploring";
    return null;
  }

  private static scoreTimeline(collectedData: CollectedData) {
    const label = ScoreHelper.normalizeTimelineLabel(collectedData);
    return label ? TIMELINE_SCORE_BY_LABEL[label] : 0;
  }

  private static isLowSignalMessage(message: string) {
    const normalized = normalizeText(message);
    return LOW_SIGNAL_MESSAGES.has(normalized) || normalized.length <= 6;
  }

  private static hasIntentKeyword(userMessages: string[], keywords: string[]) {
    const combined = normalizeText(userMessages.join(" "));
    return keywords.some((keyword) => combined.includes(keyword));
  }

  private static scoreEngagement(collectedData: CollectedData, userMessages: string[]) {
    const answeredCount = ConversationHelper.getCollectedUserFieldCount(collectedData);
    const substantiveMessages = userMessages.filter((message) => !ScoreHelper.isLowSignalMessage(message)).length;
    const lowSignalMessages = userMessages.filter((message) => ScoreHelper.isLowSignalMessage(message)).length;
    const isCompletedFlow = ConversationHelper.getMissingRequiredStep(collectedData) === null;

    let score = 0;

    if (answeredCount >= 8) score += 8;
    else if (answeredCount === 7) score += 7;
    else if (answeredCount === 6) score += 6;
    else if (answeredCount === 5) score += 4;
    else if (answeredCount === 4) score += 2;
    else if (answeredCount >= 3) score += 1;

    if (substantiveMessages >= 6) score += 3;
    else if (substantiveMessages >= 4) score += 2;
    else if (substantiveMessages >= 2) score += 1;
    else if (userMessages.length > 0) score += 1;

    if (userMessages.length > 0) {
      if (lowSignalMessages <= 1) score += 3;
      else if (lowSignalMessages <= 2) score += 1;
    }

    if (isCompletedFlow) score += 4;
    if (ScoreHelper.hasIntentKeyword(userMessages, SUGGESTION_INTENT_KEYWORDS)) score += 4;
    if (ScoreHelper.hasIntentKeyword(userMessages, VISUAL_INTENT_KEYWORDS)) score += 4;
    if (ScoreHelper.normalizeTimelineLabel(collectedData) === "This Month") score += 3;
    if (answeredCount >= 6 && ScoreHelper.hasIntentKeyword(userMessages, PURCHASE_INTENT_KEYWORDS)) score += 4;

    return Math.min(25, score);
  }

  static calculate(
    collectedData: CollectedData,
    userMessages: string[],
    recommendedProducts: Array<{ priceRange: string }>
  ): ScoreBreakdown {
    const productType = String(collectedData.productType ?? "");
    const budget = String(collectedData.budget ?? "");
    const areaSqft = String(collectedData.areaSqft ?? "");
    const roomType = String(collectedData.roomType ?? "");
    const style = String(collectedData.style ?? "");

    const budgetScore = ScoreHelper.scoreBudgetAlignment(productType, budget, recommendedProducts);
    const spaceScore = ScoreHelper.scoreSpace(areaSqft);
    const productScore = productType.trim() ? 15 : roomType && style ? 6 : roomType || style ? 3 : 0;
    const timelineScore = ScoreHelper.scoreTimeline(collectedData);
    const engagementScore = ScoreHelper.scoreEngagement(collectedData, userMessages);
    const total = Math.min(100, budgetScore + spaceScore + productScore + timelineScore + engagementScore);

    return {
      budget: budgetScore,
      space: spaceScore,
      productInterest: productScore,
      timeline: timelineScore,
      engagement: engagementScore,
      total,
    };
  }

  static determineStatus(score: number): LeadStatus {
    if (score >= SCORE_THRESHOLDS.HOT) return LeadStatus.HOT;
    if (score >= SCORE_THRESHOLDS.WARM) return LeadStatus.WARM;
    return LeadStatus.COLD;
  }

  static determineTrigger(
    handoverKeyword: string | null,
    wantsCallback: boolean,
    score: number
  ): string {
    if (handoverKeyword) return handoverKeyword;
    if (wantsCallback) return "Wants Callback";
    if (score >= SCORE_THRESHOLDS.HOT) return "Score >= 70";
    if (score >= SCORE_THRESHOLDS.WARM) return "Warm Lead";
    return "Early Stage";
  }
}
