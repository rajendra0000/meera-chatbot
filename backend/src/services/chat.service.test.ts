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

function countLines(text: string) {
  return text.split(/\r?\n+/).filter((line) => line.trim()).length;
}

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

const brickProduct = {
  id: "terra-brick",
  name: "Terra Brick",
  category: "Brick Cladding",
  priceRange: "Rs 200-400/sqft",
  dimensions: "Strip based",
  imageUrl: "terra-brick-main.webp",
  imageUrls: JSON.stringify(["terra-brick-main.webp", "terra-brick-angle.webp"]),
  bestFor: "Warm exterior facades",
  description: "Brick cladding for warm facade accents",
  textures: "Rustic",
  productUrl: "https://example.com/terra-brick",
};

function buildCompleteLead(overrides: Record<string, unknown> = {}) {
  return {
    name: "Aman",
    productType: "Wall Panels (H-UHPC)",
    city: "Delhi",
    budget: "Flexible",
    areaSqft: "250",
    roomType: "Living Room",
    style: "Modern",
    timeline: "1-3 Months",
    ...overrides,
  };
}

test("Call 1 success runs backend logic and invokes Call 2 with post-backend context", async () => {
  mockCatalogLookups();

  let call2Payload: any = null;
  let validatorPayload: any = null;
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
    groqTextCompletion: async (system, user) => {
      if (system.includes("Answer ONLY YES or NO")) {
        validatorPayload = JSON.parse(user);
        return "YES";
      }
      call2Payload = JSON.parse(user);
      return "Perfect. About how much area do you want to cover?";
    },
  });

  const result = await processMessage({
    message: "under 200",
    currentStep: ChatStep.BUDGET,
    collectedData: { name: "Aman", productType: "Wall Murals", city: "Delhi" },
    history: ["assistant: What budget range feels right for this project?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.reply, "Perfect. About how much area do you want to cover?");
  assert.equal(result.nextStep, ChatStep.AREA);
  assert.equal(result.collectedData.budget, "Under ₹200/sqft");
  assert.equal(call2Payload.currentStep, ChatStep.AREA);
  assert.equal(call2Payload.intent, "STEP_ANSWER");
  assert.equal(call2Payload.toneContext.productType, "Wall Murals");
  assert.equal(call2Payload.toneContext.city, "Delhi");
  assert.match(call2Payload.approvedReply, /About how much area/i);
  assert.equal(validatorPayload.INTENT, "STEP_ANSWER");
  assert.match(validatorPayload.BACKEND_APPROVED_REPLY, /About how much area/i);
  assert.equal(result.replySource, "phrased");
  assert.equal(result.validatorAccepted, true);
  assert.equal(result.validatorUsed, true);
  assert.equal(result.validatorReason, null);
});

test("Call 1 failure falls back directly to deterministic parsing", async () => {
  mockCatalogLookups();

  const groqCalls: string[] = [];
  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async (_system, user) => {
      groqCalls.push(user);
      throw new Error("call1 failed");
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

  assert.equal(groqCalls.length, 1);
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

test("wrong polished reply is rejected when it changes the next question", async () => {
  mockCatalogLookups();

  let textCallCount = 0;
  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "STEP_ANSWER",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: null,
        extractedValue: "Under â‚¹200/sqft",
        switchIntent: null,
        nextStep: "AREA",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async () => {
      textCallCount += 1;
      return "Nice. Which room or space is this for?";
    },
  });

  const result = await processMessage({
    message: "under 200",
    currentStep: ChatStep.BUDGET,
    collectedData: { name: "Aman", productType: "Wall Murals", city: "Delhi" },
    history: ["assistant: What budget range feels right for this project?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(textCallCount, 1);
  assert.match(result.reply, /About how much area/i);
  assert.equal(result.replySource, "deterministic");
  assert.equal(result.validatorAccepted, false);
  assert.equal(result.validatorUsed, true);
  assert.equal(result.validatorReason, "question_intent_changed");
});

test("vague polished reply is rejected before it reaches the user", async () => {
  mockCatalogLookups();

  let textCallCount = 0;
  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "STEP_ANSWER",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: null,
        extractedValue: "Under â‚¹200/sqft",
        switchIntent: null,
        nextStep: "AREA",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async () => {
      textCallCount += 1;
      return "Sounds good.";
    },
  });

  const result = await processMessage({
    message: "under 200",
    currentStep: ChatStep.BUDGET,
    collectedData: { name: "Aman", productType: "Wall Murals", city: "Delhi" },
    history: ["assistant: What budget range feels right for this project?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(textCallCount, 1);
  assert.match(result.reply, /About how much area/i);
  assert.equal(result.replySource, "deterministic");
  assert.equal(result.validatorAccepted, false);
  assert.equal(result.validatorUsed, true);
  assert.equal(result.validatorReason, "question_presence_changed");
});

test("validator NO falls back cleanly to the approved reply", async () => {
  mockCatalogLookups();

  let textCallCount = 0;
  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "STEP_ANSWER",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: null,
        extractedValue: "Under â‚¹200/sqft",
        switchIntent: null,
        nextStep: "AREA",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async (system) => {
      textCallCount += 1;
      if (system.includes("Answer ONLY YES or NO")) {
        return "NO";
      }
      return "Perfect. Roughly how much area do you want to cover?";
    },
  });

  const result = await processMessage({
    message: "under 200",
    currentStep: ChatStep.BUDGET,
    collectedData: { name: "Aman", productType: "Wall Murals", city: "Delhi" },
    history: ["assistant: What budget range feels right for this project?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(textCallCount, 2);
  assert.match(result.reply, /About how much area/i);
  assert.equal(result.replySource, "deterministic");
  assert.equal(result.validatorAccepted, false);
  assert.equal(result.validatorUsed, true);
  assert.equal(result.validatorReason, "llm_validator_rejected");
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

test("budget strings with /sqft do not contaminate area extraction", async () => {
  mockCatalogLookups();

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () => {
      throw new Error("llm disabled");
    },
    groqTextCompletion: async () => "",
  });

  const result = await processMessage({
    message: "₹200-400/sqft",
    currentStep: ChatStep.BUDGET,
    collectedData: { name: "Aman", productType: "Brick Cladding", city: "Udaipur" },
    history: ["assistant: What budget range feels right for this project?"],
    lastRecommendedProductIds: [],
  });

  assert.match(String(result.collectedData.budget), /200-400/);
  assert.equal(result.collectedData.areaSqft, undefined);
  assert.equal(result.nextStep, ChatStep.AREA);
});

test("mid-flow image requests can switch category and show options without repeating the pending field", async () => {
  mockCatalogLookups([brickProduct, ...recentProducts]);

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () => {
      throw new Error("llm disabled");
    },
    groqTextCompletion: async () => {
      throw new Error("call2 should be skipped on control turns");
    },
  });

  const result = await processMessage({
    message: "show me some pictures of wall pannels",
    currentStep: ChatStep.ROOM_TYPE,
    collectedData: {
      name: "Aman",
      productType: "Brick Cladding",
      activeCategoryLock: "Brick Cladding",
      city: "Udaipur",
      budget: "Rs 200-400/sqft",
      areaSqft: "250",
    },
    history: ["assistant: Which room or space is this for?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.collectedData.productType, "Wall Panels (H-UHPC)");
  assert.equal(result.collectedData.activeCategoryLock, "Wall Panels (H-UHPC)");
  assert.equal(result.recommendProducts.length, 3);
  assert.match(result.reply, /wall panels|options/i);
  assert.doesNotMatch(result.reply, /Which room|space is this for|What style/i);
  assert.equal(result.nextStep, ChatStep.ROOM_TYPE);
});

test("generic image requests after options were shown do not repeat the pending field question", async () => {
  mockCatalogLookups(recentProducts);

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () => {
      throw new Error("llm disabled");
    },
    groqTextCompletion: async () => {
      throw new Error("call2 should be skipped on control turns");
    },
  });

  const result = await processMessage({
    message: "Can you show me some pictures",
    currentStep: ChatStep.STYLE,
    collectedData: {
      name: "Aman",
      productType: "Wall Panels (H-UHPC)",
      city: "Delhi",
      budget: "â‚¹400+/sqft",
      areaSqft: "250",
      roomType: "Living Room",
      hasShownProducts: true,
      shownProductIds: ["furrow", "serene"],
    },
    history: ["assistant: Here are a few options I'd shortlist for you."],
    lastRecommendedProductIds: ["furrow", "serene"],
  });

  assert.equal(result.nextStep, ChatStep.STYLE);
  assert.match(result.reply, /Which product would you like more images of/i);
  assert.doesNotMatch(result.reply, /What style|leaning toward/i);
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

test("repeated question polish is blocked and falls back to the approved reply", async () => {
  mockCatalogLookups();

  let textCallCount = 0;
  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [{ question: "How long does it take?", answer: "It depends on the site." }] as any,
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "FAQ_QUESTION",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: null,
        extractedValue: null,
        switchIntent: null,
        nextStep: "AREA",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async () => {
      textCallCount += 1;
      return "About how much area do you want to cover?";
    },
  });

  const result = await processMessage({
    message: "how long does installation take?",
    currentStep: ChatStep.AREA,
    collectedData: { name: "Aman", productType: "Wall Panels (H-UHPC)", city: "Delhi", budget: "Flexible" },
    history: ["assistant: About how much area do you want to cover?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(textCallCount, 1);
  assert.match(result.reply, /About how much area do you want to cover/i);
  assert.equal(result.replySource, "deterministic");
  assert.equal(result.validatorAccepted, false);
  assert.equal(result.validatorUsed, true);
  assert.equal(result.validatorReason, "repeated_question");
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
  assert.match(result.reply, /What budget range are you considering/i);
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
  assert.ok(result.reply.indexOf("Great news - we have a showroom near you!") < result.reply.indexOf("What budget range are you considering"));
  assert.match(result.reply, /Delhi Studio - MG Road/);
});

test("style answers advance to timeline and attach only timeline quick replies", async () => {
  mockCatalogLookups();

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () => {
      throw new Error("llm disabled");
    },
    groqTextCompletion: async () => "",
  });

  const result = await processMessage({
    message: "Modern",
    currentStep: ChatStep.STYLE,
    collectedData: {
      name: "Aman",
      productType: "Wall Panels (H-UHPC)",
      city: "Udaipur",
      budget: "Flexible",
      areaSqft: "250",
      roomType: "Living Room",
    },
    history: ["assistant: What look are you leaning toward?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.nextStep, ChatStep.TIMELINE);
  assert.equal(result.collectedData.style, "Modern");
  assert.deepEqual(result.quickReplies, ["This Month", "1-3 Months", "3-6 Months", "Just Exploring"]);
  assert.equal(result.recommendProducts.length, 0);
  assert.match(result.reply, /When are you planning this/i);
});

[
  { message: "thinking to start this month", expectedTimeline: "This Month" },
  { message: "start soon", expectedTimeline: "This Month" },
  { message: "in a few months", expectedTimeline: "1-3 Months" },
].forEach(({ message, expectedTimeline }) => {
  test(`timeline free text "${message}" normalizes to ${expectedTimeline}`, async () => {
    mockCatalogLookups();

    __setChatServiceDepsForTests({
      getActivePromptBundle: async () => promptBundle,
      searchFaqByKeywords: async () => [],
      groqJsonCompletion: async () => {
        throw new Error("llm disabled");
      },
      groqTextCompletion: async () => "",
    });

    const result = await processMessage({
      message,
      currentStep: ChatStep.TIMELINE,
      collectedData: buildCompleteLead({ timeline: undefined, city: "Udaipur" }),
      history: ["assistant: When are you planning to start this?"],
      lastRecommendedProductIds: [],
    });

    assert.equal(result.nextStep, ChatStep.COMPLETED);
    assert.equal(result.collectedData.timeline, expectedTimeline);
    assert.deepEqual(result.quickReplies, []);
  });
});

test("purchase intent like 'I want to buy this' uses the collected city and skips product recommendations", async () => {
  let productLookupCount = 0;
  stubMethod(prisma.product, "findMany", (async () => {
    productLookupCount += 1;
    return recentProducts;
  }) as typeof prisma.product.findMany);
  stubMethod(prisma.showroom, "findMany", (async () => [
    { id: "showroom-1", city: "Udaipur", name: "Udaipur Studio", address: "Fateh Sagar Road", contact: "9999999999" }
  ]) as typeof prisma.showroom.findMany);

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () => {
      throw new Error("llm disabled");
    },
    groqTextCompletion: async () => "",
  });

  const result = await processMessage({
    message: "I want to buy this",
    currentStep: ChatStep.COMPLETED,
    collectedData: {
      name: "Aman",
      productType: "Wall Panels (H-UHPC)",
      city: "Udaipur",
      budget: "â‚¹400+/sqft",
      areaSqft: "250",
      roomType: "Living Room",
      style: "Modern",
      timeline: "This Month",
      hasShownProducts: true,
      shownProductIds: ["furrow"],
    },
    history: ["assistant: Nice, I've picked a few options for you."],
    lastRecommendedProductIds: ["furrow"],
  });

  assert.equal(result.nextStep, ChatStep.COMPLETED);
  assert.equal(result.handover, false);
  assert.equal(result.recommendProducts.length, 0);
  assert.equal(productLookupCount, 0);
  assert.match(result.reply, /showroom in Udaipur/i);
  assert.match(result.reply, /details|connect/i);
});

test("visit intent uses normalized city matching and skips recommendation loops", async () => {
  let productLookupCount = 0;
  stubMethod(prisma.product, "findMany", (async () => {
    productLookupCount += 1;
    return recentProducts;
  }) as typeof prisma.product.findMany);
  stubMethod(prisma.showroom, "findMany", (async () => [
    { id: "showroom-1", city: "Delhi", name: "Delhi Studio", address: "MG Road", contact: "9999999999" }
  ]) as typeof prisma.showroom.findMany);

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () => {
      throw new Error("llm disabled");
    },
    groqTextCompletion: async () => "",
  });

  const result = await processMessage({
    message: "where should I visit?",
    currentStep: ChatStep.COMPLETED,
    collectedData: {
      ...buildCompleteLead({
        city: "New Delhi",
        budget: "Rs 400+/sqft",
        hasShownProducts: true,
        shownProductIds: ["furrow"],
      }),
    },
    history: ["assistant: Nice, I've picked a few options for you."],
    lastRecommendedProductIds: ["furrow"],
  });

  assert.equal(result.nextStep, ChatStep.COMPLETED);
  assert.equal(result.recommendProducts.length, 0);
  assert.equal(productLookupCount, 0);
  assert.match(result.reply, /showroom in New Delhi/i);
  assert.match(result.reply, /Delhi Studio - MG Road/i);
  assert.match(result.reply, /contact|connect/i);
});

test("completed follow-ups do not loop back into product recommendations once products were shown", async () => {
  mockCatalogLookups(recentProducts);

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () => {
      throw new Error("llm disabled");
    },
    groqTextCompletion: async () => "",
  });

  const result = await processMessage({
    message: "okay",
    currentStep: ChatStep.COMPLETED,
    collectedData: {
      name: "Aman",
      productType: "Wall Panels (H-UHPC)",
      city: "Delhi",
      budget: "â‚¹400+/sqft",
      areaSqft: "250",
      roomType: "Living Room",
      style: "Modern",
      timeline: "1-3 Months",
      hasShownProducts: true,
      shownProductIds: ["furrow", "serene"],
    },
    history: ["assistant: Nice, I've picked a few options for you."],
    lastRecommendedProductIds: ["furrow", "serene"],
  });

  assert.equal(result.recommendProducts.length, 0);
  assert.match(result.reply, /compare|images|showroom/i);
});

test("more options stays category-locked when the current category is exhausted", async () => {
  mockCatalogLookups([brickProduct, ...recentProducts]);

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () => {
      throw new Error("llm disabled");
    },
    groqTextCompletion: async () => "",
  });

  const result = await processMessage({
    message: "more options",
    currentStep: ChatStep.COMPLETED,
    collectedData: {
      ...buildCompleteLead({
        productType: "Brick Cladding",
        activeCategoryLock: "Brick Cladding",
        city: "Udaipur",
        budget: "Rs 200-400/sqft",
        hasShownProducts: true,
        shownProductIds: ["terra-brick"],
      }),
    },
    history: ["assistant: Nice, I've picked a few options for you."],
    lastRecommendedProductIds: ["terra-brick"],
  });

  assert.equal(result.recommendProducts.length, 0);
  assert.equal(result.collectedData.activeCategoryLock, "Brick Cladding");
  assert.match(result.reply, /brick cladding/i);
  assert.match(result.reply, /compare|another category|explore/i);
  assert.doesNotMatch(result.reply, /wall panels|furrow|serene|ridge/i);
});

test("robotic recap phrasing falls back to the approved short reply", async () => {
  mockCatalogLookups();

  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () =>
      JSON.stringify({
        messageType: "STEP_ANSWER",
        reply: "[REPLY GENERATED IN CALL 2]",
        extractedField: null,
        extractedValue: "Under â‚¹200/sqft",
        switchIntent: null,
        nextStep: "AREA",
        recommendProductIds: [],
        handover: false,
      }),
    groqTextCompletion: async () =>
      "It seems like you're planning a smaller project in a modern style. What material do you want? What finish do you like?",
  });

  const result = await processMessage({
    message: "under 200",
    currentStep: ChatStep.BUDGET,
    collectedData: { name: "Aman", productType: "Wall Murals", city: "Delhi" },
    history: ["assistant: What budget range are you considering?"],
    lastRecommendedProductIds: [],
  });

  assert.equal(result.nextStep, ChatStep.AREA);
  assert.match(result.reply, /About how much area do you want to cover/i);
  assert.doesNotMatch(result.reply, /It seems|So you're/i);
  assert.ok(countLines(result.reply) <= 3);
  assert.ok(((result.reply.match(/\?/g) ?? []).length) <= 1);
});
