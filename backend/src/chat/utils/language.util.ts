import { normalizeLower } from "./normalization.util.js";

export function looksUnsupportedLanguage(message: string) {
  const normalized = normalizeLower(message);
  return normalized.startsWith("bonjour") || normalized.startsWith("salut");
}
