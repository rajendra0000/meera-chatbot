import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import {
  __getLoadedGroqKeyLabelsForTests,
  __resetGroqStateForTests,
  __setGroqClientFactoryForTests,
  __setGroqTimeoutMsForTests,
  groqJsonCompletion,
  groqTextCompletion,
} from "./groq.js";

const ORIGINAL_ENV = {
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_API_KEY_2: process.env.GROQ_API_KEY_2,
  GROQ_API_KEY_3: process.env.GROQ_API_KEY_3,
  GROQ_API_KEY_4: process.env.GROQ_API_KEY_4,
  GROQ_API_KEY_5: process.env.GROQ_API_KEY_5,
};

function setGroqEnv(keys: string[]) {
  process.env.GROQ_API_KEY = keys[0] ?? "";
  process.env.GROQ_API_KEY_2 = keys[1] ?? "";
  process.env.GROQ_API_KEY_3 = keys[2] ?? "";
  process.env.GROQ_API_KEY_4 = keys[3] ?? "";
  process.env.GROQ_API_KEY_5 = keys[4] ?? "";
}

afterEach(() => {
  process.env.GROQ_API_KEY = ORIGINAL_ENV.GROQ_API_KEY;
  process.env.GROQ_API_KEY_2 = ORIGINAL_ENV.GROQ_API_KEY_2;
  process.env.GROQ_API_KEY_3 = ORIGINAL_ENV.GROQ_API_KEY_3;
  process.env.GROQ_API_KEY_4 = ORIGINAL_ENV.GROQ_API_KEY_4;
  process.env.GROQ_API_KEY_5 = ORIGINAL_ENV.GROQ_API_KEY_5;
  __resetGroqStateForTests();
});

test("loads up to 5 keys and starts each request in round-robin order", async () => {
  setGroqEnv(["k1", "k2", "k3", "k4", "k5"]);
  __resetGroqStateForTests();

  const usedKeys: string[] = [];
  __setGroqClientFactoryForTests((apiKey) => ({
    chat: {
      completions: {
        create: async () => {
          usedKeys.push(apiKey);
          return { choices: [{ message: { content: "{\"ok\":true}" } }] };
        },
      },
    },
  }));

  assert.deepEqual(__getLoadedGroqKeyLabelsForTests(), ["k1", "k2", "k3", "k4", "k5"]);

  await groqJsonCompletion("system", "first");
  await groqTextCompletion("system", "second");
  await groqJsonCompletion("system", "third");

  assert.deepEqual(usedKeys, ["k1", "k2", "k3"]);
});

test("remains backward compatible when only 3 keys are configured", async () => {
  setGroqEnv(["k1", "k2", "k3"]);
  __resetGroqStateForTests();

  const usedKeys: string[] = [];
  __setGroqClientFactoryForTests((apiKey) => ({
    chat: {
      completions: {
        create: async () => {
          usedKeys.push(apiKey);
          return { choices: [{ message: { content: "{\"ok\":true}" } }] };
        },
      },
    },
  }));

  assert.deepEqual(__getLoadedGroqKeyLabelsForTests(), ["k1", "k2", "k3"]);

  await groqJsonCompletion("system", "one");
  await groqJsonCompletion("system", "two");
  await groqTextCompletion("system", "three");
  await groqJsonCompletion("system", "four");

  assert.deepEqual(usedKeys, ["k1", "k2", "k3", "k1"]);
});

test("retries on 429 by switching to the next key and caps total attempts at 3", async () => {
  setGroqEnv(["k1", "k2", "k3", "k4", "k5"]);
  __resetGroqStateForTests();

  const usedKeys: string[] = [];
  __setGroqClientFactoryForTests((apiKey) => ({
    chat: {
      completions: {
        create: async () => {
          usedKeys.push(apiKey);
          if (apiKey === "k2" || apiKey === "k3") {
            throw { status: 429 };
          }
          return { choices: [{ message: { content: "{\"ok\":true}" } }] };
        },
      },
    },
  }));

  await groqJsonCompletion("system", "prime");
  const result = await groqJsonCompletion("system", "retry-case");

  assert.equal(result, "{\"ok\":true}");
  assert.deepEqual(usedKeys, ["k1", "k2", "k3", "k4"]);
});

test("retries timeouts on the next key for text requests", async () => {
  setGroqEnv(["k1", "k2", "k3"]);
  __resetGroqStateForTests();
  __setGroqTimeoutMsForTests(5);

  const usedKeys: string[] = [];
  __setGroqClientFactoryForTests((apiKey) => ({
    chat: {
      completions: {
        create: async () => {
          usedKeys.push(apiKey);
          if (apiKey === "k1") {
            return await new Promise(() => undefined);
          }
          return { choices: [{ message: { content: " grounded reply " } }] };
        },
      },
    },
  }));

  const result = await groqTextCompletion("system", "timeout-case");

  assert.equal(result, "grounded reply");
  assert.deepEqual(usedKeys, ["k1", "k2"]);
});
