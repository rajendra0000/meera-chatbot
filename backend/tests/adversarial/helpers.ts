import { afterEach } from "node:test";
import { ChatStep } from "@prisma/client";
import { prisma } from "../../src/lib/prisma.js";
import {
  __resetChatServiceDepsForTests,
  __setChatServiceDepsForTests,
  processMessage,
} from "../../src/services/chat.service.js";
import { ChatRuntimeDeps } from "../../src/chat/types/chat.types.js";
import { CollectedData } from "../../src/types/conversation.types.js";

const restorers: Array<() => void> = [];

export const recentProducts = [
  {
    id: "furrow",
    name: "Furrow",
    category: "Wall Panels (H-UHPC)",
    priceRange: "â‚¹400+/sqft",
    dimensions: "Panel based",
    imageUrl: "furrow-main.webp",
    imageUrls: JSON.stringify(["furrow-main.webp", "furrow-2.webp"]),
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
    id: "breeze-1",
    name: "Breeze Block 1",
    category: "Breeze Blocks",
    priceRange: "â‚¹200-400/piece",
    dimensions: "300 x 300 mm",
    imageUrl: "breeze-main.webp",
    imageUrls: JSON.stringify(["breeze-main.webp"]),
    bestFor: "Garden and partition walls",
    description: "Decorative breeze block",
    textures: "Natural",
    productUrl: "https://example.com/breeze-1",
  },
];

export function stubMethod<T extends object, K extends keyof T>(target: T, key: K, implementation: T[K]) {
  const original = target[key];
  (target as T & Record<K, T[K]>)[key] = implementation;
  restorers.push(() => {
    (target as T & Record<K, T[K]>)[key] = original;
  });
}

export function mockCatalogLookups({
  products = [],
  showrooms = [],
}: {
  products?: any[];
  showrooms?: any[];
} = {}) {
  stubMethod(prisma.product, "findMany", (async (args?: { where?: { id?: { in?: string[] } } }) => {
    const requestedIds = args?.where?.id?.in;
    if (!requestedIds) {
      return products;
    }
    return products.filter((product) => requestedIds.includes(product.id));
  }) as typeof prisma.product.findMany);
  stubMethod(prisma.showroom, "findMany", (async () => showrooms) as typeof prisma.showroom.findMany);
}

export function setDeterministicChatDeps(overrides: Partial<ChatRuntimeDeps> = {}) {
  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => null,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () => {
      throw new Error("llm disabled for deterministic adversarial test");
    },
    groqTextCompletion: async () => "",
    ...overrides,
  });
}

export async function runTurns(params: {
  currentStep: ChatStep;
  collectedData: CollectedData;
  turns: string[];
  history?: string[];
  lastRecommendedProductIds?: string[];
}) {
  let currentStep = params.currentStep;
  let collectedData = { ...params.collectedData };
  let history = [...(params.history ?? [])];
  let lastRecommendedProductIds = [...(params.lastRecommendedProductIds ?? [])];
  const results: Array<Awaited<ReturnType<typeof processMessage>>> = [];

  for (const turn of params.turns) {
    const result = await processMessage({
      message: turn,
      currentStep,
      collectedData,
      history,
      lastRecommendedProductIds,
    });

    results.push(result);
    currentStep = result.nextStep;
    collectedData = { ...result.collectedData };
    history = [...history, `USER: ${turn}`, `ASSISTANT: ${result.reply}`].slice(-6);
    lastRecommendedProductIds = result.recommendProducts.map((product) => product.id);
  }

  return {
    results,
    last: results.at(-1),
    state: {
      currentStep,
      collectedData,
      history,
      lastRecommendedProductIds,
    },
  };
}

export function restoreChatTestState() {
  while (restorers.length > 0) {
    restorers.pop()?.();
  }
  __resetChatServiceDepsForTests();
}

afterEach(() => {
  restoreChatTestState();
});
