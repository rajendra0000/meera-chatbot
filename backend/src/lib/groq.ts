import Groq from "groq-sdk";

type CompletionMode = "json" | "text";
type GroqCompletionResult = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};
type GroqClientLike = {
  chat: {
    completions: {
      create: (payload: {
        model: string;
        temperature: number;
        response_format?: { type: "json_object" };
        messages: Array<{ role: "system" | "user"; content: string }>;
      }) => Promise<GroqCompletionResult>;
    };
  };
};

const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_GROQ_TIMEOUT_MS = 10000;

let groqTimeoutMs = DEFAULT_GROQ_TIMEOUT_MS;
let nextKeyIndex = 0;
let groqClientFactory: (apiKey: string) => GroqClientLike = (apiKey) => new Groq({ apiKey });

function loadApiKeys() {
  return [
    process.env.GROQ_API_KEY,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY_5,
  ].filter((value): value is string => Boolean(value));
}

const initialApiKeys = loadApiKeys();

if (!initialApiKeys.length) {
  console.warn("[groq] No GROQ_API_KEY set - all Groq calls will use fallback logic");
} else {
  console.log(`[groq] Groq initialized with ${initialApiKeys.length} key(s)`);
}

function getNextStartIndex(totalKeys: number) {
  if (totalKeys <= 0) return 0;
  const startIndex = nextKeyIndex % totalKeys;
  nextKeyIndex = (startIndex + 1) % totalKeys;
  return startIndex;
}

function getClientForIndex(index: number, apiKeys: string[]) {
  return groqClientFactory(apiKeys[index]);
}

function getNextKeyNumber(currentIndex: number, totalKeys: number) {
  return ((currentIndex + 1) % totalKeys) + 1;
}

function isRetryableStatus(status: unknown) {
  return status === 429 || status === 503;
}

async function runGroqCompletion(system: string, user: string, mode: CompletionMode): Promise<string | null> {
  const apiKeys = loadApiKeys();
  const logPrefix = mode === "json" ? "[groq]" : "[groq:text]";

  if (!apiKeys.length) {
    console.warn(`${logPrefix} No client - returning null (API key missing)`);
    return null;
  }

  const label = user.slice(0, 80).replace(/\n/g, " ").trim();
  const start = Date.now();
  const attemptLimit = Math.min(MAX_RETRY_ATTEMPTS, apiKeys.length);
  const startIndex = getNextStartIndex(apiKeys.length);

  for (let attempt = 0; attempt < attemptLimit; attempt++) {
    const keyIndex = (startIndex + attempt) % apiKeys.length;

    try {
      console.log(`${logPrefix} Using Groq key #${keyIndex + 1}/${apiKeys.length} for ${mode} request | "${label}..."`);

      const activeClient = getClientForIndex(keyIndex, apiKeys);
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), groqTimeoutMs)
      );
      const payload = {
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      } as {
        model: string;
        temperature: number;
        response_format?: { type: "json_object" };
        messages: Array<{ role: "system" | "user"; content: string }>;
      };

      if (mode === "json") {
        payload.response_format = { type: "json_object" };
      }

      const completionPromise = activeClient.chat.completions.create(payload);
      const result = await Promise.race([completionPromise, timeoutPromise]);
      const elapsed = Date.now() - start;

      if (!result) {
        if (attempt < attemptLimit - 1) {
          console.warn(
            `${logPrefix} Timeout on key #${keyIndex + 1}, retrying with key #${getNextKeyNumber(keyIndex, apiKeys.length)}`
          );
          continue;
        }

        console.warn(`${logPrefix} Timeout after ${elapsed}ms on key #${keyIndex + 1}`);
        continue;
      }

      const content =
        mode === "text"
          ? result.choices?.[0]?.message?.content?.trim() ?? null
          : result.choices?.[0]?.message?.content ?? null;
      const snippet = content?.slice(0, 120).replace(/\n/g, " ") ?? "null";
      console.log(`${logPrefix} Response in ${elapsed}ms | ${snippet}`);
      return content;
    } catch (err: any) {
      const elapsed = Date.now() - start;

      if (isRetryableStatus(err?.status)) {
        if (attempt < attemptLimit - 1) {
          console.warn(
            `${logPrefix} Rate limit hit on key #${keyIndex + 1} after ${elapsed}ms, switching to key #${getNextKeyNumber(keyIndex, apiKeys.length)}`
          );
          continue;
        }

        console.warn(`${logPrefix} Retryable error ${err?.status} on key #${keyIndex + 1} after ${elapsed}ms`);
        continue;
      }

      console.error(`${logPrefix} ERROR after ${elapsed}ms:`, err);
      return null;
    }
  }

  console.error(`${logPrefix} All retries exhausted for ${mode} request`);
  return null;
}

export async function groqJsonCompletion(system: string, user: string): Promise<string | null> {
  return runGroqCompletion(system, user, "json");
}

export async function groqTextCompletion(system: string, user: string): Promise<string | null> {
  return runGroqCompletion(system, user, "text");
}

export function __resetGroqStateForTests() {
  nextKeyIndex = 0;
  groqTimeoutMs = DEFAULT_GROQ_TIMEOUT_MS;
  groqClientFactory = (apiKey) => new Groq({ apiKey });
}

export function __setGroqClientFactoryForTests(factory: (apiKey: string) => GroqClientLike) {
  groqClientFactory = factory;
}

export function __setGroqTimeoutMsForTests(timeoutMs: number) {
  groqTimeoutMs = timeoutMs;
}

export function __getLoadedGroqKeyLabelsForTests() {
  return loadApiKeys();
}
