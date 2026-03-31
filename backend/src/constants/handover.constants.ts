// ─────────────────────────────────────────────────────────────────────────────
// Handover trigger keywords
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unambiguous phrases that always trigger a handover to Kabir.
 * Kept minimal to avoid false positives. Other handover triggers are:
 *   - score >= 70 (score-based)
 *   - LLM detecting wantsCallback
 *   - HANDOVER_REQUEST messageType from the LLM
 */
export const HANDOVER_KEYWORDS = [
  "call me",
  "showroom visit",
  "visit showroom",
  "custom size",
  "franchise",
  "place an order",
  "i want to order",
  "book it",
  "confirm my order",
  "ready to buy",
  "i'll take it",
  "how do i purchase",
  "want to purchase",
  "let's finalize",
  "confirm the order",
  "export",
  "ship to",
  "shipping to",
  "outside india",
  "international shipping",
  "dubai",
  "abroad",
  "overseas",
  "foreign country",
  "nepal",
  "uk",
  "usa",
  "canada",
  "australia",
  "deliver internationally"
];
