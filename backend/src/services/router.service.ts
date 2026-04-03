import { isVagueConversationValue } from "../constants/conversation.constants.js";

export type RouterResult = {
  type: "FAQ_QUESTION" | "STEP_ANSWER" | "GREETING" | "SHOW_PRODUCTS" | "IRRELEVANT" | "VAGUE";
  extractedValue: string | null;
  confidence: number;
  isVague: boolean;
};

/**
 * Deterministic fallback when Groq is unavailable.
 * Uses reliable signal detection (question markers, Hinglish patterns).
 * NEVER returns FAQ_QUESTION spuriously — requires clear question signals.
 */
export function fallbackRouter(message: string, _step: string): RouterResult {
  const lower = message.toLowerCase().trim();

  // Question detection (very reliable signals)
  const questionStarters = [
    "how", "what", "when", "where", "why", "which",
    "can i", "do you", "is it", "are you", "will you",
    "does it", "kya", "kaise", "kitna", "kaun", "kab"
  ];
  const isQuestion =
    lower.endsWith("?") ||
    questionStarters.some((q) => lower.startsWith(q));

  if (isQuestion) {
    return { type: "FAQ_QUESTION", extractedValue: null, confidence: 0.9, isVague: false };
  }

  // Show products request (Hinglish + English)
  const showKeywords = [
    "dikao", "dikaye", "dikhao", "dikha", "show me",
    "show", "pehle dekh", "examples", "options", "pieces",
    "pictures", "picture", "photos", "photo", "images", "image", "pics", "pic",
    "kuch dekh", "dikha do"
  ];
  if (showKeywords.some((k) => lower.includes(k))) {
    return { type: "SHOW_PRODUCTS", extractedValue: null, confidence: 0.85, isVague: false };
  }

  // Greeting detection
  const greetings = ["namaste", "hello", "hi ", "hii", "hey", "namaskar", "jai hind", "good morning", "good evening"];
  if (greetings.some((g) => lower.startsWith(g) || lower === g.trim())) {
    return { type: "GREETING", extractedValue: null, confidence: 0.9, isVague: false };
  }

  // Vague / unknown answer detection
  const vagueKeywords = [
    "pta ni", "pata nahi", "pata ni", "idk", "not sure",
    "dont know", "don't know", "nahi pata", "nhi pta",
    "kuch ni", "unknown", "flexible", "koi bhi",
    "pta nhi", "nahi", "no idea", "pata nahin"
  ];
  if (vagueKeywords.some((k) => lower.includes(k))) {
    return { type: "VAGUE", extractedValue: null, confidence: 0.8, isVague: true };
  }

  if (isVagueConversationValue(message)) {
    return { type: "VAGUE", extractedValue: null, confidence: 0.8, isVague: true };
  }

  // Default: treat as step answer with moderate confidence
  return { type: "STEP_ANSWER", extractedValue: message, confidence: 0.5, isVague: false };
}
