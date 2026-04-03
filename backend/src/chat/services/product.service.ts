import { ChatStep } from "@prisma/client";
import { ProductRepository } from "../repositories/product.repository.js";
import { Product } from "../../types/chat.types.js";
import { CollectedData } from "../../types/conversation.types.js";
import { RecommendationResult } from "../types/response.types.js";
import { ConversationHelper } from "../../helpers/conversation.helper.js";
import { resolveProductMedia } from "../../helpers/product-media.helper.js";

const MORE_IMAGES_PATTERNS = [
  "more images",
  "more photos",
  "more pictures",
  "more image",
  "more photo",
] as const;

const IMAGE_REQUEST_PATTERNS = [
  ...MORE_IMAGES_PATTERNS,
  "show me pictures",
  "show pictures",
  "show me photos",
  "show photos",
  "show me images",
  "show images",
  "show me some pictures",
  "show me some photos",
  "show some pictures",
  "show some photos",
  "show pics",
  "show me pics",
  "pictures of",
  "photos of",
  "images of",
  "pic of",
  "pics of",
  "picture of",
  "photo of",
] as const;

function hasUsableImage(imageUrl?: string) {
  return Boolean(imageUrl && !imageUrl.includes("placehold.co"));
}

function toChatProduct(product: Awaited<ReturnType<ProductRepository["findAll"]>>[number]): Product | null {
  const media = resolveProductMedia({
    imageUrl: product.imageUrl,
    imageUrls: product.imageUrls,
  });

  if (!hasUsableImage(media.thumbnailUrl ?? undefined)) {
    return null;
  }

  return {
    id: product.id,
    name: product.name,
    category: product.category,
    priceRange: product.priceRange,
    dimensions: product.dimensions,
    imageUrl: media.thumbnailUrl ?? "",
    thumbnailUrl: media.thumbnailUrl,
    bestFor: product.bestFor,
    description: product.description,
    textures: product.textures,
    imageUrls: JSON.stringify(media.galleryImages),
    galleryImages: media.galleryImages,
    shadeImages: media.shadeImages,
    productUrl: product.productUrl,
  };
}

export function mapProductTypeToCategory(productType?: string) {
  const normalized = productType?.trim().toLowerCase() ?? "";
  if (normalized.includes("breeze")) return "Breeze Blocks";
  if (normalized.includes("mural")) return "Wall Murals";
  if (normalized.includes("brick")) return "Brick Cladding";
  if (normalized.includes("panel")) return "Wall Panels (H-UHPC)";
  return null;
}

export function resolveActiveCategoryLock(collectedData: CollectedData) {
  const storedLock = typeof collectedData.activeCategoryLock === "string"
    ? collectedData.activeCategoryLock.trim()
    : "";

  if (storedLock) {
    return storedLock;
  }

  return mapProductTypeToCategory(String(collectedData.productType ?? ""));
}

export function isImageRequestMessage(message: string) {
  const lowered = message.toLowerCase();
  return IMAGE_REQUEST_PATTERNS.some((pattern) => lowered.includes(pattern));
}

export function isMoreImagesRequestMessage(message: string) {
  const lowered = message.toLowerCase();
  return MORE_IMAGES_PATTERNS.some((pattern) => lowered.includes(pattern));
}

export function applyProductSwitchState(collectedData: CollectedData, productType: string): CollectedData {
  const nextCategory = mapProductTypeToCategory(productType) ?? productType;
  return {
    ...collectedData,
    productType,
    activeCategoryLock: nextCategory,
    hasShownProducts: false,
    shownProductIds: [],
    pendingImageMode: undefined,
    pendingImageProductIds: undefined,
    pendingImageCategory: undefined,
    pendingImageProductName: undefined,
    pendingImageRequestedProductId: undefined,
  };
}

function normalizeProductMatchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function findMatchingRecentProduct(message: string, candidateProducts: Product[]) {
  const normalizedMessage = normalizeProductMatchText(message);
  if (!normalizedMessage) return null;

  const direct = candidateProducts.find((product) =>
    normalizeProductMatchText(product.name) === normalizedMessage ||
    normalizeProductMatchText(product.id) === normalizedMessage
  );
  if (direct) return direct;

  const partialMatches = candidateProducts.filter((product) => {
    const normalizedName = normalizeProductMatchText(product.name);
    return normalizedName.includes(normalizedMessage) || normalizedMessage.includes(normalizedName);
  });
  return partialMatches.length === 1 ? partialMatches[0] : null;
}

function displayCategoryName(category?: string | null) {
  if (!category) return "this category";
  return category.replace(/\s*\(.*?\)\s*/g, "").trim();
}

function detectPositiveImageSwitchResponse(message: string) {
  const lowered = message.toLowerCase();
  return ["switch", "yes", "haan", "show it", "go ahead", "ok switch", "yes switch"].some((keyword) =>
    lowered.includes(keyword)
  );
}

function detectContinueCurrentCategoryResponse(message: string) {
  const lowered = message.toLowerCase();
  return ["continue", "stay", "current", "no switch", "don't switch", "dont switch"].some((keyword) =>
    lowered.includes(keyword)
  );
}

function hasExtraGalleryImages(product: Product) {
  return (product.galleryImages ?? []).length > 1;
}

export class ProductService {
  constructor(private readonly productRepository = new ProductRepository()) {}

  async getRecommendedProducts(
    collectedData: CollectedData,
    limit = 4,
    excludeIds: string[] = [],
    options: { ignoreBudgetGuard?: boolean } = {}
  ): Promise<Product[]> {
    const allProducts = await this.productRepository.findAll();
    let filtered = allProducts.filter((product) => !excludeIds.includes(product.id));

    let targetCategory = resolveActiveCategoryLock(collectedData);
    if (targetCategory) {
      const activeCategory = targetCategory;
      filtered = filtered.filter((product) => product.category.toLowerCase().includes(activeCategory.toLowerCase()));
    }

    if (options.ignoreBudgetGuard && targetCategory === "Wall Panels (H-UHPC)") {
      targetCategory = "";
    }

    const budget = String(collectedData.budget ?? "");
    if (targetCategory === "Wall Panels (H-UHPC)" && budget && budget !== "₹400+/sqft" && budget !== "Flexible" && budget !== "â‚¹400+/sqft") {
      return [];
    }

    const result = filtered
      .map((product) => toChatProduct(product))
      .filter((product): product is Product => Boolean(product))
      .slice(0, limit);

    return result;
  }

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    const products = await this.productRepository.findByIds(ids);
    return ids
      .map((id) => products.find((product) => product.id === id))
      .filter((product): product is NonNullable<typeof product> => Boolean(product))
      .map((product) => toChatProduct(product))
      .filter((product): product is Product => Boolean(product));
  }

  async buildRecommendation(params: {
    collectedData: CollectedData;
    limit?: number;
    excludeIds?: string[];
    ignoreBudgetGuard?: boolean;
  }): Promise<RecommendationResult> {
    const products = await this.getRecommendedProducts(
      params.collectedData,
      params.limit ?? 4,
      params.excludeIds ?? [],
      { ignoreBudgetGuard: params.ignoreBudgetGuard }
    );
    return {
      products,
      exhausted: products.length === 0,
      reason: products.length === 0 ? "catalog_exhausted_or_budget_guard" : null,
      nextBrowseCursor: products.map((product) => product.id),
    };
  }

  async handleMoreImagesFlow(params: {
    message: string;
    currentStep: ChatStep;
    collectedData: CollectedData;
    lastRecommendedProductIds: string[];
  }): Promise<
    | { handled: false }
    | {
        handled: true;
        reply: string;
        nextStep: ChatStep;
        collectedData: CollectedData;
        recommendProducts: Product[];
        isMoreImages: boolean;
        quickReplies: string[];
      }
  > {
    const recentImageCandidateIds = params.lastRecommendedProductIds.length > 0
      ? params.lastRecommendedProductIds
      : (params.collectedData.shownProductIds ?? []).slice(-4);

    const quickReplies = params.currentStep === ChatStep.COMPLETED ? [] : ConversationHelper.getQuickReplies(params.currentStep);

    if (params.collectedData.pendingImageMode === "awaiting_category_confirmation") {
      const pendingProductId = String(params.collectedData.pendingImageRequestedProductId ?? "");
      const pendingProducts = await this.getProductsByIds(pendingProductId ? [pendingProductId] : []);
      const pendingProduct = pendingProducts[0] ?? null;
      const currentCategory = resolveActiveCategoryLock(params.collectedData);
      const clearedData = {
        ...params.collectedData,
        pendingImageMode: undefined,
        pendingImageProductIds: undefined,
        pendingImageCategory: undefined,
        pendingImageProductName: undefined,
        pendingImageRequestedProductId: undefined,
      };

      if (pendingProduct) {
        if (detectPositiveImageSwitchResponse(params.message)) {
          if (!hasExtraGalleryImages(pendingProduct)) {
            return {
              handled: true,
              reply: `I only have one verified photo of ${pendingProduct.name} right now. Want to compare it or see another option?`,
              nextStep: params.currentStep,
              collectedData: clearedData,
              recommendProducts: [],
              isMoreImages: false,
              quickReplies,
            };
          }

          return {
            handled: true,
            reply: `Sure, here are more images of ${pendingProduct.name}.`,
            nextStep: params.currentStep,
            collectedData: {
              ...clearedData,
              shownProductIds: Array.from(new Set([...(clearedData.shownProductIds ?? []), pendingProduct.id])),
            },
            recommendProducts: [pendingProduct],
            isMoreImages: true,
            quickReplies,
          };
        }

        if (detectContinueCurrentCategoryResponse(params.message)) {
          return {
            handled: true,
            reply: `No problem - we'll stay with ${displayCategoryName(currentCategory)}.`,
            nextStep: params.currentStep,
            collectedData: clearedData,
            recommendProducts: [],
            isMoreImages: false,
            quickReplies,
          };
        }

        return {
          handled: true,
          reply: `${pendingProduct.name} is from ${displayCategoryName(pendingProduct.category)}. You're currently looking at ${displayCategoryName(currentCategory)}. Would you like to switch and see images of ${pendingProduct.name}, or continue with ${displayCategoryName(currentCategory)}?`,
          nextStep: params.currentStep,
          collectedData: params.collectedData,
          recommendProducts: [],
          isMoreImages: false,
          quickReplies,
        };
      }
    }

    if (params.collectedData.pendingImageMode === "awaiting_product") {
      const pendingIds = params.collectedData.pendingImageProductIds ?? recentImageCandidateIds;
      const candidateProducts = await this.getProductsByIds(pendingIds);
      if (candidateProducts.length === 0) {
        return {
          handled: true,
          reply: "I couldn't find the products I just showed, so please ask me to see the options again.",
          nextStep: params.currentStep,
          collectedData: { ...params.collectedData, pendingImageMode: undefined, pendingImageProductIds: undefined },
          recommendProducts: [],
          isMoreImages: false,
          quickReplies,
        };
      }

      const matched = findMatchingRecentProduct(params.message, candidateProducts);
      if (!matched) {
        return {
          handled: true,
          reply: `I couldn't identify that product from the ones I just showed. Please pick one of these: ${candidateProducts.slice(0, 3).map((product) => product.name).join(", ")}`,
          nextStep: params.currentStep,
          collectedData: params.collectedData,
          recommendProducts: [],
          isMoreImages: false,
          quickReplies,
        };
      }

      const currentCategory = resolveActiveCategoryLock(params.collectedData);
      if (currentCategory && matched.category !== currentCategory) {
        return {
          handled: true,
          reply: `${matched.name} is from ${displayCategoryName(matched.category)}. You're currently looking at ${displayCategoryName(currentCategory)}. Would you like to switch and see images of ${matched.name}, or continue with ${displayCategoryName(currentCategory)}?`,
          nextStep: params.currentStep,
          collectedData: {
            ...params.collectedData,
            pendingImageMode: "awaiting_category_confirmation",
            pendingImageRequestedProductId: matched.id,
            pendingImageProductName: matched.name,
            pendingImageCategory: matched.category,
          },
          recommendProducts: [],
          isMoreImages: false,
          quickReplies,
        };
      }

      if (!hasExtraGalleryImages(matched)) {
        return {
          handled: true,
          reply: `I only have one verified photo of ${matched.name} right now. Want to compare it or see another option?`,
          nextStep: params.currentStep,
          collectedData: {
            ...params.collectedData,
            pendingImageMode: undefined,
            pendingImageProductIds: undefined,
          },
          recommendProducts: [],
          isMoreImages: false,
          quickReplies,
        };
      }

      return {
        handled: true,
        reply: `Sure, here are more images of ${matched.name}.`,
        nextStep: params.currentStep,
        collectedData: {
          ...params.collectedData,
          pendingImageMode: undefined,
          pendingImageProductIds: undefined,
          shownProductIds: Array.from(new Set([...(params.collectedData.shownProductIds ?? []), matched.id])),
        },
        recommendProducts: [matched],
        isMoreImages: true,
        quickReplies,
      };
    }

    const asksForImages = isImageRequestMessage(params.message);

    if (!asksForImages) {
      return { handled: false };
    }

    if (recentImageCandidateIds.length === 0) {
      return { handled: false };
    }

    const candidateProducts = await this.getProductsByIds(recentImageCandidateIds);
    const matched = findMatchingRecentProduct(params.message, candidateProducts);
    if (matched) {
      if (!hasExtraGalleryImages(matched)) {
        return {
          handled: true,
          reply: `I only have one verified photo of ${matched.name} right now. Want to compare it or see another option?`,
          nextStep: params.currentStep,
          collectedData: params.collectedData,
          recommendProducts: [],
          isMoreImages: false,
          quickReplies,
        };
      }

      return {
        handled: true,
        reply: `Sure, here are more images of ${matched.name}.`,
        nextStep: params.currentStep,
        collectedData: {
          ...params.collectedData,
          shownProductIds: Array.from(new Set([...(params.collectedData.shownProductIds ?? []), matched.id])),
        },
        recommendProducts: [matched],
        isMoreImages: true,
        quickReplies,
      };
    }

    return {
      handled: true,
      reply: `Sure! Which product would you like more images of? Here are the ones I just showed: ${candidateProducts.slice(0, 3).map((product) => product.name).join(", ")}`,
      nextStep: params.currentStep,
      collectedData: {
        ...params.collectedData,
        pendingImageMode: "awaiting_product",
        pendingImageProductIds: candidateProducts.map((product) => product.id),
      },
      recommendProducts: [],
      isMoreImages: false,
      quickReplies,
    };
  }
}
