import { normalizeWhitespace } from "./normalization.util.js";

export function isRepeatedCharacterSpam(message: string) {
  const normalized = normalizeWhitespace(message);
  return normalized.length >= 8 && /^([a-z0-9!?.])\1+$/i.test(normalized);
}

export function isEmptyMessage(message: string) {
  return normalizeWhitespace(message).length === 0;
}
