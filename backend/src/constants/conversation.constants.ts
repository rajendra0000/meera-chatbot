export const VAGUE_INPUT_VALUES = [
  "okay",
  "ok",
  "sure",
  "fine",
  "alright",
  "yes",
  "no",
  "haan",
  "theek hai",
  "theek",
  "hmm",
  "hm",
  "yeah",
  "yep",
  "nope",
  "k",
  "kk",
  "got it",
  "understood",
  "noted",
  "great",
  "good",
  "nice"
] as const;

export const VAGUE_INPUT_SET = new Set<string>(VAGUE_INPUT_VALUES);

export const STYLE_INPUT_HINTS = [
  "minimal",
  "minimalist",
  "minimalistic",
  "modern",
  "geometric",
  "textured",
  "statement",
  "traditional",
  "classic",
  "contemporary",
  "bold",
  "natural",
  "rustic",
  "luxury",
  "industrial",
  "organic",
  "elegant",
  "biophilic",
  "vintage",
  "eclectic",
  "indian",
  "heritage",
  "scandi",
  "scandinavian",
  "japandi",
  "maximalist",
  "abstract",
  "tropical",
  "coastal",
  "brutalist",
  "boho",
  "bohemian",
  "art deco",
  "wabi sabi",
  "earthy",
  "monochrome"
] as const;

export const TIMELINE_INPUT_HINTS = [
  // Immediate / this month
  "immediate",
  "immediately",
  "this month",
  "this week",
  "start soon",
  "starting soon",
  "start this month",
  "starting this month",
  "thinking to start this month",
  "thinking to start soon",
  "soon",
  "right away",
  "asap",
  "as soon as possible",
  "urgent",
  "urgently",
  "jaldi",
  // 1-3 months
  "1-3 months",
  "1-3",
  "1 to 3",
  "next month",
  "few months",
  "in a few months",
  "couple of months",
  "2 mahine",
  "thoda time",
  // 3-6 months
  "3-6 months",
  "3-6",
  "3 to 6",
  "4-5 mahine",
  // Just exploring
  "just exploring",
  "just browsing",
  "only exploring",
  "browsing",
  "not sure yet",
  "exploring options",
  "exploring",
  "dekh raha",
  "abhi nahi",
  "no rush"
] as const;

type TimelineLabel = "This Month" | "1-3 Months" | "3-6 Months" | "Just Exploring";

const TIMELINE_NORMALIZATION_RULES: Array<{ label: TimelineLabel; patterns: string[] }> = [
  {
    label: "This Month",
    patterns: [
      "this month",
      "this week",
      "start this month",
      "starting this month",
      "thinking to start this month",
      "thinking to start soon",
      "start soon",
      "starting soon",
      "soon",
      "immediate",
      "immediately",
      "right away",
      "asap",
      "as soon as possible",
      "urgent",
      "urgently",
      "jaldi",
    ],
  },
  {
    label: "1-3 Months",
    patterns: [
      "1-3 months",
      "1-3",
      "1 to 3",
      "next month",
      "few months",
      "in a few months",
      "couple of months",
      "2 mahine",
      "thoda time",
    ],
  },
  {
    label: "3-6 Months",
    patterns: [
      "3-6 months",
      "3-6",
      "3 to 6",
      "4-5 mahine",
    ],
  },
  {
    label: "Just Exploring",
    patterns: [
      "just exploring",
      "just browsing",
      "only exploring",
      "browsing",
      "not sure yet",
      "exploring options",
      "exploring",
      "dekh raha",
      "abhi nahi",
      "no rush",
    ],
  },
];

export function normalizeConversationValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeTimelineValue(value: string | null | undefined): TimelineLabel | null {
  const normalized = normalizeConversationValue(value).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  for (const rule of TIMELINE_NORMALIZATION_RULES) {
    if (rule.patterns.some((pattern) => normalized.includes(pattern))) {
      return rule.label;
    }
  }

  return null;
}

export function isVagueConversationValue(value: string | null | undefined) {
  const normalized = normalizeConversationValue(value);
  // Use <= 1 (not <= 2) to match the isMeaningfulValue threshold and allow
  // 2-character names like "Jo", "Al", "Li" to be treated as valid.
  return normalized.length > 0 && (VAGUE_INPUT_SET.has(normalized) || normalized.length <= 1);
}
