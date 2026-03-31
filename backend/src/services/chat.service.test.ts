import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { ChatStep } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  __resetChatServiceDepsForTests,
  __setChatServiceDepsForTests,
  processMessage,
} from "./chat.service.js";

const promptBundle = {
  system: "system",
  learning: "learning",
  combined: "combined",
  promptVersionId: 99,
  promptVersionLabel: "test",
};
const restorers: Array<() => void> = [];

function stubMethod<T extends object, K extends keyof T>(target: T, key: K, implementation: T[K]) {
  const original = target[key];
  (target as T & Record<K, T[K]>)[key] = implementation;
  restorers.push(() => {
    (target as T & Record<K, T[K]>)[key] = original;
  });
}

afterEach(() => {
  while (restorers.length > 0) {
    restorers.pop()?.();
  }
  __resetChatServiceDepsForTests();
});

function mockCatalogLookups(products: any[] = []) {
  stubMethod(prisma.product, "findMany", (async () => products) as typeof prisma.product.findMany);
  stubMethod(prisma.showroom, "findMany", (async () => []) as typeof prisma.showroom.findMany);
}

const recentProducts = [
  {
    id: "furrow",
    name: "Furrow",
    category: "Wall Panels (H-UHPC)",
    priceRange: "â‚¹400+/sqft",
    dimensions: "Panel based",
    imageUrl: "furrow-main.webp",
    imageUrls: JSON.stringify(["furrow-main.webp", "furrow-2.webp", "furrow-3.webp"]),
    bestFor: "Textured contemporary feature walls",
    description: "Fluted wall panel for textured spaces",
    textures: "Plain, Porous",
    productUrl: "https://example.com/furrow",
  },
  {
    id: "serene",
    name: "Serene",
    category: "Wall Panels (H-UHPC)",
    priceRange: "â‚¹400+/sqft",
    dimensions: "Panel based",
    imageUrl: "serene-main.webp",
    imageUrls: JSON.stringify(["serene-main.webp", "serene-2.webp"]),
    bestFor: "Calm premium living rooms",
    description: "Soft premium wall panel",
    textures: "Plain, Natural",
    productUrl: "https://example.com/serene",
  },
  {
    id: "ridge",
    name: "Ridge",
    category: "Wall Panels (H-UHPC)",
    priceRange: "â‚¹400+/sqft",
    dimensions: "Panel based",
    imageUrl: "ridge-main.webp",
    imageUrls: JSON.stringify(["ridge-main.webp", "ridge-2.webp"]),
    bestFor: "Vertical drama in living rooms and lobbies",
    description: "Ridge line wall panel",
    textures: "Plain, Natural",
    productUrl: "https://example.com/ridge",
  },
];

test("Call 1 success runs backend logic and invokes Call 2 with post-backend context", async () => {
  mockCatalogLookups();

  let call2Payload: any = null;
  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "STEP_ANSWER",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: null,
        extractedValue: "Under ₹200/sqft",
        switchIntent: null,
        nextStep: "AREA",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async (_system, user) => {
      call2Payload = JSON.parse(user);
      return "Grounded reply from Call 2";
    },
  });

  const result = await processMessage({
    message: "under 200",
    currentStep: ChatStep.BUDGET,
    collectedData: { name: "Aman", productType: "Wall Murals", city: "Delhi" },
    history: ["assistant: What budget range feels right for this project?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.reply, "Grounded reply from Call 2");
  assert.equal(result.nextStep, ChatStep.AREA);
  assert.equal(result.collectedData.budget, "Under ₹200/sqft");
  assert.equal(call2Payload.CURRENT_STEP, ChatStep.AREA);
  assert.equal(call2Payload.COLLECTED_DATA.budget, "Under ₹200/sqft");
  assert.equal(call2Payload.NORMALIZED_INPUT.messageType, "STEP_ANSWER");
});

test("Call 1 failure falls back to the original single-call path", async () => {
  mockCatalogLookups();

  const groqCalls: string[] = [];
  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async (_system, user) => {
      groqCalls.push(user);
      if (groqCalls.length === 1) {
        throw new Error("call1 failed");
      }

      return JSON.stringify({
        messageType: "STEP_ANSWER",
        reply: "Fallback old-path reply",
        extractedField: null,
        extractedValue: "Delhi",
        switchIntent: null,
        nextStep: "BUDGET",
        recommendProductIds: [],
        handover: false,
      });
    },
    groqTextCompletion: async () => "",
  });

  const result = await processMessage({
    message: "Delhi",
    currentStep: ChatStep.CITY,
    collectedData: { name: "Aman", productType: "Wall Panels (H-UHPC)" },
    history: ["assistant: Which city are you based in?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(groqCalls.length, 2);
  assert.equal(result.nextStep, ChatStep.BUDGET);
  assert.equal(result.collectedData.city, "Delhi");
});

test("Call 1 and original single-call failure still fall back to deterministic parsing", async () => {
  mockCatalogLookups();

  let textCallCount = 0;
  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () => null,
    groqTextCompletion: async () => {
      textCallCount += 1;
      return "";
    },
  });

  const result = await processMessage({
    message: "skip",
    currentStep: ChatStep.NAME,
    collectedData: {},
    history: ["assistant: May I know your name before we get started?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.nextStep, ChatStep.NAME);
  assert.match(result.reply, /nickname works/i);
  assert.equal(textCallCount, 0);
});

test("Call 2 failure keeps the existing deterministic fallback reply", async () => {
  mockCatalogLookups();

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "STEP_ANSWER",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: null,
        extractedValue: "Under ₹200/sqft",
        switchIntent: null,
        nextStep: "AREA",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async () => {
      throw new Error("call2 failed");
    },
  });

  const result = await processMessage({
    message: "under 200",
    currentStep: ChatStep.BUDGET,
    collectedData: { name: "Aman", productType: "Wall Murals", city: "Delhi" },
    history: ["assistant: What budget range feels right for this project?"],
    lastRecommendedProductIds: [],
  });

  assert.match(result.reply, /How much area/i);
  assert.equal(result.nextStep, ChatStep.AREA);
});

test("Call 2 empty reply keeps the deterministic fallback reply", async () => {
  mockCatalogLookups();

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "STEP_ANSWER",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: null,
        extractedValue: "Under ₹200/sqft",
        switchIntent: null,
        nextStep: "AREA",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async () => "   ",
  });

  const result = await processMessage({
    message: "under 200",
    currentStep: ChatStep.BUDGET,
    collectedData: { name: "Aman", productType: "Wall Murals", city: "Delhi" },
    history: ["assistant: What budget range feels right for this project?"],
    lastRecommendedProductIds: [],
  });

  assert.match(result.reply, /How much area/i);
  assert.equal(result.nextStep, ChatStep.AREA);
});

test("completed-mode area updates still map through the existing area handling", async () => {
  mockCatalogLookups();

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "FREE_CHAT_REPLY",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: "area",
        extractedValue: "300+",
        switchIntent: "CONFIRMED_SWITCH",
        nextStep: "COMPLETED",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async () => "",
  });

  const result = await processMessage({
    message: "make it bigger, above 300 sqft",
    currentStep: ChatStep.COMPLETED,
    collectedData: { name: "Aman", productType: "Wall Panels (H-UHPC)", budget: "₹400+/sqft", areaSqft: "100-300" },
    history: ["assistant: Here are a few options I'd shortlist for you"],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.collectedData.areaSqft, "300+");
});

test("VAGUE budget responses still normalize safely", async () => {
  mockCatalogLookups();

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "VAGUE",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: null,
        extractedValue: "Flexible",
        switchIntent: null,
        nextStep: "AREA",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async () => "",
  });

  const result = await processMessage({
    message: "koi bhi",
    currentStep: ChatStep.BUDGET,
    collectedData: { name: "Aman", productType: "Wall Panels (H-UHPC)", city: "Delhi" },
    history: ["assistant: What budget range feels right for this project?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.collectedData.budget, "Flexible");
  assert.equal(result.nextStep, ChatStep.AREA);
});

test("repeat answers do not regress step advancement", async () => {
  mockCatalogLookups();

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "STEP_ANSWER",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: null,
        extractedValue: "Delhi",
        switchIntent: null,
        nextStep: "CITY",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async () => "",
  });

  const result = await processMessage({
    message: "Delhi",
    currentStep: ChatStep.CITY,
    collectedData: { name: "Aman", productType: "Wall Panels (H-UHPC)" },
    history: ["assistant: Which city are you based in?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.nextStep, ChatStep.BUDGET);
  assert.equal(result.collectedData.city, "Delhi");
});

test("budget guard still triggers for wall panels under 200 on completed-mode switch", async () => {
  mockCatalogLookups();

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "FREE_CHAT_REPLY",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: "budget",
        extractedValue: "Under ₹200/sqft",
        switchIntent: "CONFIRMED_SWITCH",
        nextStep: "COMPLETED",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async () => "This should be ignored by the budget guard",
  });

  const result = await processMessage({
    message: "switch my budget to under 200",
    currentStep: ChatStep.COMPLETED,
    collectedData: { name: "Aman", productType: "Wall Panels (H-UHPC)", budget: "₹400+/sqft" },
    history: ["assistant: Here are a few options I'd shortlist for you"],
    lastRecommendedProductIds: [],
  });

  assert.match(result.reply, /Breeze Blocks|Brick Cladding/i);
  assert.equal(result.collectedData.budget, "Under ₹200/sqft");
});
test("pre-completion FAQ answers stay on the current step and keep current quick replies", async () => {
  mockCatalogLookups();

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [{ question: "How long does installation take?", answer: "Installation usually depends on the site conditions." }] as any,
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "FAQ_QUESTION",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: null,
        extractedValue: null,
        switchIntent: null,
        nextStep: "STYLE",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async () => "",
  });

  const result = await processMessage({
    message: "how long does installation take?",
    currentStep: ChatStep.BUDGET,
    collectedData: { name: "Aman", productType: "Wall Panels (H-UHPC)", city: "Delhi" },
    history: ["assistant: What budget range feels right for this project?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.nextStep, ChatStep.BUDGET);
  assert.deepEqual(result.quickReplies, ["Under ₹200/sqft", "₹200-400/sqft", "₹400+/sqft", "Flexible"]);
  assert.match(result.reply, /What budget range feels right/i);
});

test("semantic filler answers do not advance required steps", async () => {
  mockCatalogLookups();

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "STEP_ANSWER",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: null,
        extractedValue: "okay",
        switchIntent: null,
        nextStep: "TIMELINE",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async () => "",
  });

  const result = await processMessage({
    message: "okay",
    currentStep: ChatStep.STYLE,
    collectedData: {
      name: "Aman",
      productType: "Wall Panels (H-UHPC)",
      city: "Delhi",
      budget: "Flexible",
      areaSqft: "250",
      roomType: "Living Room",
    },
    history: ["assistant: What kind of look are you leaning toward?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.nextStep, ChatStep.STYLE);
  assert.equal(result.collectedData.style, undefined);
  assert.match(result.reply, /minimal, modern, geometric/i);
});

test("city replies place showroom info before the next-step question", async () => {
  mockCatalogLookups();
  stubMethod(prisma.showroom, "findMany", (async () => [
    { id: "showroom-1", city: "Delhi", name: "Delhi Studio", address: "MG Road", contact: "9999999999" }
  ]) as typeof prisma.showroom.findMany);

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "STEP_ANSWER",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: null,
        extractedValue: "Delhi",
        switchIntent: null,
        nextStep: "BUDGET",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async () => "",
  });

  const result = await processMessage({
    message: "Delhi",
    currentStep: ChatStep.CITY,
    collectedData: { name: "Aman", productType: "Wall Panels (H-UHPC)" },
    history: ["assistant: Which city are you based in?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.nextStep, ChatStep.BUDGET);
  assert.ok(result.reply.indexOf("Great news - we have a showroom near you!") < result.reply.indexOf("What budget range feels right"));
  assert.match(result.reply, /Delhi Studio - MG Road/);
});
