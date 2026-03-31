export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeLower(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

export function toWords(value: string) {
  return normalizeLower(value)
    .replace(/[^\p{L}\p{N}\s+-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}
