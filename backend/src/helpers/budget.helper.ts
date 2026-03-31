import { BUDGET_MIDPOINTS, BUDGET_SIZE_WORDS, BUDGET_VAGUE_WORDS } from "../constants/budget.constants.js";
import { BudgetRange } from "../types/conversation.types.js";

export class BudgetHelper {
  static normalize(value: string, isVague: boolean): BudgetRange {
    if (!value || isVague) return "Flexible";

    const normalized = value
      .toLowerCase()
      .trim()
      .replace(/[â‚¹]/g, "")
      .replace(/\/sqft/g, "")
      .trim();
    const hasNumericSignal = /\d/.test(normalized);

    if (!hasNumericSignal && BUDGET_SIZE_WORDS.some((word) => normalized.includes(word))) return "Flexible";
    if (BUDGET_VAGUE_WORDS.some((word) => normalized.includes(word))) return "Flexible";

    if (
      normalized.includes("400+") ||
      normalized.includes("above 400") ||
      normalized.includes("upar 400") ||
      normalized.includes("premium") ||
      normalized.includes("expensive") ||
      normalized.includes("high budget") ||
      normalized.includes("best quality") ||
      normalized.includes("no budget") ||
      (/400/.test(normalized) && /[+]|above|upar/.test(normalized))
    ) {
      return "₹400+/sqft";
    }

    if (
      normalized.includes("200-400") ||
      normalized.includes("200 to 400") ||
      normalized.includes("200 400") ||
      normalized.includes("moderate") ||
      normalized.includes("beech mein") ||
      normalized.includes("middle") ||
      (/200/.test(normalized) && /400/.test(normalized))
    ) {
      return "₹200-400/sqft";
    }

    if (
      normalized.includes("under 200") ||
      normalized.includes("below 200") ||
      normalized.includes("less than 200") ||
      normalized.includes("kam budget") ||
      normalized.includes("cheap") ||
      normalized.includes("sasta") ||
      normalized.includes("affordable") ||
      normalized.includes("low budget") ||
      (/200/.test(normalized) && /under|below|less|kam/.test(normalized))
    ) {
      return "Under ₹200/sqft";
    }

    const number = parseInt(normalized.match(/\d+/)?.[0] ?? "0", 10);
    if (number > 0 && number <= 200) return "Under ₹200/sqft";
    if (number > 200 && number <= 400) return "₹200-400/sqft";
    if (number > 400) return "₹400+/sqft";

    return "Flexible";
  }

  static getMidpoint(budget: string): number {
    return BUDGET_MIDPOINTS[budget] ?? 200;
  }
}
