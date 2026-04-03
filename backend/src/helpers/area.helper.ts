import { AREA_HINTS, AREA_MIDPOINTS } from "../constants/area.constants.js";

// ─────────────────────────────────────────────────────────────────────────────
// AreaHelper — single source of truth for area extraction
// ─────────────────────────────────────────────────────────────────────────────

export interface AreaExtractResult {
  area: string;
  score: number;
  mode: "known" | "vague" | "unknown";
}

type ExtractAreaOptions = {
  requireExplicitHint?: boolean;
};

const EXPLICIT_AREA_HINTS = [
  "area",
  "cover",
  "coverage",
  "wall size",
  "approx area",
  "approximate area",
  "square feet",
  "sq ft",
  "sqft",
  "square foot",
  "surface area",
  "wall area",
] as const;

const AREA_RATE_PATTERN = /(?:\/|per\s+)(sqft|sq\.?ft|square feet|square foot|feet|ft)\b/;

export class AreaHelper {
  static hasExplicitAreaHint(value: string) {
    const normalized = value.toLowerCase().trim();
    return EXPLICIT_AREA_HINTS.some((hint) => normalized.includes(hint));
  }

  /**
   * Extract a normalised area value from raw user input.
   *
   * Returns:
   *   - area: numeric string (e.g. "250") or label ("<100" | "100-300" | "300+")
   *   - score: 20 = exact sqft, 10 = keyword label, 5 = unknown
   *   - mode: "known" | "vague" | "unknown"
   */
  static extract(value: string, options: ExtractAreaOptions = {}): AreaExtractResult {
    if (!value) return { area: "Not captured", score: 5, mode: "unknown" };

    const l = value.toLowerCase().trim();
    const requireExplicitHint = options.requireExplicitHint === true;
    const hasExplicitHint = AreaHelper.hasExplicitAreaHint(l);
    const looksLikeRatePerArea = AREA_RATE_PATTERN.test(l);

    if (requireExplicitHint && !hasExplicitHint) {
      return { area: "Not captured", score: 5, mode: "unknown" };
    }

    if (looksLikeRatePerArea && !l.includes("cover") && !l.includes("area") && !l.includes("wall size")) {
      return { area: "Not captured", score: 5, mode: "unknown" };
    }

    if (/\b(above|over|more than)\s*300\b/.test(l)) {
      return { area: "300+", score: 20, mode: "known" };
    }

    if (/\b(under|below|less than)\s*100\b/.test(l)) {
      return { area: "<100", score: 20, mode: "known" };
    }

    if (/\b100\s*-\s*300\b/.test(l)) {
      return { area: "100-300", score: 20, mode: "known" };
    }

    // 1. Exact sqft number first
    const numMatch = l.match(/(\d+)\s*(sqft|sq\.?ft|feet|ft|sq\b)?/);
    if (numMatch && parseInt(numMatch[1]) > 10) {
      return { area: numMatch[1], score: 20, mode: "known" };
    }

    // 2. Keyword hints
    for (const [hint, label] of Object.entries(AREA_HINTS)) {
      if (l.includes(hint)) return { area: label, score: 10, mode: "vague" };
    }

    // 3. Bare number fallback
    const bareNum = parseInt(l.match(/\d+/)?.[0] ?? "0");
    if (bareNum > 10 && (!requireExplicitHint || hasExplicitHint)) {
      return { area: String(bareNum), score: 20, mode: "known" };
    }

    return { area: "Not captured", score: 5, mode: "unknown" };
  }

  /**
   * Returns the midpoint sqft value for a given area label or raw numeric string.
   * Used for estimated order value calculations.
   */
  static getMidpoint(area: string): number {
    if (!area) return 150;
    // Exact sqft number
    if (/^\d+$/.test(area)) return Number(area);
    return AREA_MIDPOINTS[area] ?? 150;
  }
}
