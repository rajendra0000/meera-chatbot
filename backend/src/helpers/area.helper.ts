import { AREA_HINTS, AREA_MIDPOINTS } from "../constants/area.constants.js";

// ─────────────────────────────────────────────────────────────────────────────
// AreaHelper — single source of truth for area extraction
// ─────────────────────────────────────────────────────────────────────────────

export interface AreaExtractResult {
  area: string;
  score: number;
  mode: "known" | "vague" | "unknown";
}

export class AreaHelper {
  /**
   * Extract a normalised area value from raw user input.
   *
   * Returns:
   *   - area: numeric string (e.g. "250") or label ("<100" | "100-300" | "300+")
   *   - score: 20 = exact sqft, 10 = keyword label, 5 = unknown
   *   - mode: "known" | "vague" | "unknown"
   */
  static extract(value: string): AreaExtractResult {
    if (!value) return { area: "Not captured", score: 5, mode: "unknown" };

    const l = value.toLowerCase().trim();

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
    if (bareNum > 10) return { area: String(bareNum), score: 20, mode: "known" };

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
