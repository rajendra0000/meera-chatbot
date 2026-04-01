export const SCORE_THRESHOLDS = {
  COLD: 0,
  WARM: 40,
  HOT: 70,
} as const;

export const TIMELINE_SCORE_BY_LABEL = {
  "This Month": 10,
  "1-3 Months": 8,
  "3-6 Months": 5,
  "Just Exploring": 2,
} as const;
