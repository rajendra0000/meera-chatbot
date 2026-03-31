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
  "not sure yet",
  "exploring options",
  "exploring",
  "dekh raha",
  "abhi nahi",
  "no rush"
] as const;

export function normalizeConversationValue(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function isVagueConversationValue(value: string | null | undefined) {
  const normalized = normalizeConversationValue(value);
  // Use <= 1 (not <= 2) to match the isMeaningfulValue threshold and allow
  // 2-character names like "Jo", "Al", "Li" to be treated as valid.
  return normalized.length > 0 && (VAGUE_INPUT_SET.has(normalized) || normalized.length <= 1);
}
