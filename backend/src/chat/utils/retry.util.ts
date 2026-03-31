export async function withRetries<T>(
  fn: () => Promise<T>,
  options: number | {
    attempts?: number;
    shouldRetry?: (error: unknown, attempt: number) => boolean;
  } = 2
): Promise<T> {
  const attempts = typeof options === "number" ? options : options.attempts ?? 2;
  const shouldRetry =
    typeof options === "number"
      ? () => true
      : options.shouldRetry ?? (() => true);
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1 || !shouldRetry(error, attempt + 1)) {
        throw error;
      }
    }
  }

  throw lastError;
}
