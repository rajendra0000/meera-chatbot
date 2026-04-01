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

const singleImageBrickProduct = {
  id: "terra-brick",
  name: "Terra Brick",
  category: "Brick Cladding",
  priceRange: "Rs 200-400/sqft",
  dimensions: "Strip based",
  imageUrl: "terra-brick-main.webp",
  imageUrls: JSON.stringify(["terra-brick-main.webp"]),
  bestFor: "Warm exterior facades",
  description: "Brick cladding for warm facade accents",
  textures: "Rustic",
  productUrl: "https://example.com/terra-brick",
};

function mockCatalogLookups(products: any[] = []) {
  stubMethod(prisma.product, "findMany", (async () => products) as typeof prisma.product.findMany);
  stubMethod(prisma.showroom, "findMany", (async () => []) as typeof prisma.showroom.findMany);
}

function mockDeps() {
  __setChatServiceDepsForTests({
    getActivePromptBundle: async () => promptBundle,
    searchFaqByKeywords: async () => [],
    groqJsonCompletion: async () => {
      throw new Error("should not hit groq for deterministic more-images flow");
    },
    groqTextCompletion: async () => {
      throw new Error("should not hit call2 for deterministic more-images flow");
    },
  });
}

test("generic more-images request asks the user to choose from recent products", async () => {
  mockCatalogLookups(recentProducts);
  mockDeps();

  const result = await processMessage({
    message: "more pictures",
    currentStep: ChatStep.COMPLETED,
    collectedData: { name: "Aman", productType: "Wall Panels (H-UHPC)", shownProductIds: ["furrow", "serene", "ridge"] },
    history: ["assistant: Here are a few options I'd shortlist for you"],
    lastRecommendedProductIds: ["furrow", "serene", "ridge"],
  });

  assert.match(result.reply, /Which product would you like more images of/i);
  assert.match(result.reply, /Furrow, Serene, Ridge/);
  assert.equal(result.nextStep, ChatStep.COMPLETED);
  assert.equal(result.collectedData.productType, "Wall Panels (H-UHPC)");
  assert.equal(result.collectedData.pendingImageMode, "awaiting_product");
  assert.deepEqual(result.collectedData.pendingImageProductIds, ["furrow", "serene", "ridge"]);
  assert.equal(result.recommendProducts.length, 0);
});

test("product reply resolves to one exact recent product and returns all images", async () => {
  mockCatalogLookups(recentProducts);
  mockDeps();

  const result = await processMessage({
    message: "furrow 2.0",
    currentStep: ChatStep.COMPLETED,
    collectedData: {
      name: "Aman",
      productType: "Wall Panels (H-UHPC)",
      pendingImageMode: "awaiting_product",
      pendingImageProductIds: ["furrow", "serene", "ridge"],
      shownProductIds: ["furrow", "serene", "ridge"],
    },
    history: ["assistant: Sure! Which product would you like more images of?"],
    lastRecommendedProductIds: ["furrow", "serene", "ridge"],
  });

  assert.equal(result.reply, "Sure, here are more images of Furrow.");
  assert.equal(result.recommendProducts.length, 1);
  assert.equal(result.recommendProducts[0].name, "Furrow");
  assert.equal(result.recommendProducts[0].imageUrl, "furrow-main.webp");
  assert.equal(result.recommendProducts[0].imageUrls, JSON.stringify(["furrow-main.webp", "furrow-2.webp", "furrow-3.webp"]));
  assert.equal(result.collectedData.pendingImageMode, undefined);
});

test("non-matching product reply re-prompts with recent product names", async () => {
  mockCatalogLookups(recentProducts);
  mockDeps();

  const result = await processMessage({
    message: "unknown panel",
    currentStep: ChatStep.COMPLETED,
    collectedData: {
      name: "Aman",
      productType: "Wall Panels (H-UHPC)",
      pendingImageMode: "awaiting_product",
      pendingImageProductIds: ["furrow", "serene", "ridge"],
    },
    history: ["assistant: Sure! Which product would you like more images of?"],
    lastRecommendedProductIds: ["furrow", "serene", "ridge"],
  });

  assert.match(result.reply, /Please pick one of these: Furrow, Serene, Ridge/i);
  assert.equal(result.collectedData.pendingImageMode, "awaiting_product");
});

test("category mismatch asks for confirmation without mutating product type", async () => {
  mockCatalogLookups(recentProducts);
  mockDeps();

  const result = await processMessage({
    message: "Furrow",
    currentStep: ChatStep.COMPLETED,
    collectedData: {
      name: "Aman",
      productType: "Wall Murals",
      pendingImageMode: "awaiting_product",
      pendingImageProductIds: ["furrow", "serene", "ridge"],
    },
    history: ["assistant: Sure! Which product would you like more images of?"],
    lastRecommendedProductIds: ["furrow", "serene", "ridge"],
  });

  assert.match(result.reply, /Furrow is from Wall Panels/i);
  assert.match(result.reply, /currently looking at Wall Murals/i);
  assert.equal(result.collectedData.productType, "Wall Murals");
  assert.equal(result.collectedData.pendingImageMode, "awaiting_category_confirmation");
  assert.equal(result.recommendProducts.length, 0);
});

test("category confirmation switch sends images without changing product type", async () => {
  mockCatalogLookups(recentProducts);
  mockDeps();

  const result = await processMessage({
    message: "switch and show me Furrow",
    currentStep: ChatStep.COMPLETED,
    collectedData: {
      name: "Aman",
      productType: "Wall Murals",
      pendingImageMode: "awaiting_category_confirmation",
      pendingImageRequestedProductId: "furrow",
      pendingImageProductName: "Furrow",
      pendingImageCategory: "Wall Panels (H-UHPC)",
      shownProductIds: ["serene"],
    },
    history: ["assistant: Furrow is from Wall Panels. Would you like to switch?"],
    lastRecommendedProductIds: ["furrow", "serene", "ridge"],
  });

  assert.equal(result.reply, "Sure, here are more images of Furrow.");
  assert.equal(result.recommendProducts.length, 1);
  assert.equal(result.recommendProducts[0].id, "furrow");
  assert.equal(result.collectedData.productType, "Wall Murals");
  assert.equal(result.collectedData.pendingImageMode, undefined);
});

test("category confirmation continue keeps current category and clears pending state", async () => {
  mockCatalogLookups(recentProducts);
  mockDeps();

  const result = await processMessage({
    message: "continue with wall murals",
    currentStep: ChatStep.COMPLETED,
    collectedData: {
      name: "Aman",
      productType: "Wall Murals",
      pendingImageMode: "awaiting_category_confirmation",
      pendingImageRequestedProductId: "furrow",
      pendingImageProductName: "Furrow",
      pendingImageCategory: "Wall Panels (H-UHPC)",
    },
    history: ["assistant: Furrow is from Wall Panels. Would you like to switch?"],
    lastRecommendedProductIds: ["furrow", "serene", "ridge"],
  });

  assert.match(result.reply, /stay with Wall Murals/i);
  assert.equal(result.collectedData.productType, "Wall Murals");
  assert.equal(result.collectedData.pendingImageMode, undefined);
  assert.equal(result.recommendProducts.length, 0);
});

test("single-image products do not pretend to have extra gallery photos", async () => {
  mockCatalogLookups([singleImageBrickProduct]);
  mockDeps();

  const result = await processMessage({
    message: "terra brick",
    currentStep: ChatStep.COMPLETED,
    collectedData: {
      name: "Aman",
      productType: "Brick Cladding",
      activeCategoryLock: "Brick Cladding",
      pendingImageMode: "awaiting_product",
      pendingImageProductIds: ["terra-brick"],
      shownProductIds: ["terra-brick"],
    },
    history: ["assistant: Sure! Which product would you like more images of?"],
    lastRecommendedProductIds: ["terra-brick"],
  });

  assert.match(result.reply, /only have one verified photo of Terra Brick/i);
  assert.equal(result.recommendProducts.length, 0);
  assert.equal(result.isMoreImages, false);
  assert.equal(result.collectedData.pendingImageMode, undefined);
  assert.equal(result.collectedData.productType, "Brick Cladding");
});
