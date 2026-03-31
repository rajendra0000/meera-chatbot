// ─────────────────────────────────────────────────────────────────────────────
// Lead domain types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  budget: number;
  space: number;
  productInterest: number;
  timeline: number;
  engagement: number;
  total: number;
}

export interface ConversationNeeds {
  wants_callback: boolean;
  wants_sample: boolean;
}
