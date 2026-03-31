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
  "connect me",
  "human",
  "agent",
  "sales team",
  "talk to someone",
  "talk to a person",
  "custom size",
  "franchise",
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
