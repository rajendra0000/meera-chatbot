export function containsFinalQuoteLanguage(message: string) {
  const lowered = message.toLowerCase();
  return [
    "final quote",
    "exact quote",
    "formal quote",
    "quotation",
    "give me the total",
    "final price",
  ].some((pattern) => lowered.includes(pattern));
}

export function containsDiscountLanguage(message: string) {
  const lowered = message.toLowerCase();
  return ["discount", "bulk price", "bulk pricing", "best rate", "offer price"].some((pattern) =>
    lowered.includes(pattern)
  );
}
