export const SCORE_THRESHOLDS = {
  COLD: 0,
  WARM: 40,
  HOT: 70,
} as const;

export const TIMELINE_MAP: Record<string, { label: string; score: number }> = {
  "this month": { label: "This Month", score: 10 },
  immediately: { label: "This Month", score: 10 },
  immediate: { label: "This Month", score: 10 },
  asap: { label: "This Month", score: 10 },
  jaldi: { label: "This Month", score: 10 },
  urgent: { label: "This Month", score: 10 },
  "1-3 months": { label: "1-3 Months", score: 8 },
  "1-3": { label: "1-3 Months", score: 8 },
  "2 mahine": { label: "1-3 Months", score: 8 },
  "thoda time": { label: "1-3 Months", score: 8 },
  "3-6 months": { label: "3-6 Months", score: 5 },
  "3-6": { label: "3-6 Months", score: 5 },
  "4-5 mahine": { label: "3-6 Months", score: 5 },
  "just exploring": { label: "Just Exploring", score: 2 },
  exploring: { label: "Just Exploring", score: 2 },
  "dekh raha": { label: "Just Exploring", score: 2 },
  "abhi nahi": { label: "Just Exploring", score: 2 },
};
