import { ResponsePlan } from "../types/response.types.js";
import { Product } from "../../types/chat.types.js";

function getGalleryImages(product: Product) {
  if (product.galleryImages?.length) {
    return product.galleryImages;
  }

  if (!product.imageUrls) {
    return [];
  }

  try {
    const parsed = JSON.parse(product.imageUrls) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function serializeRecommendedProducts(products: Product[]) {
  return products.map((product) => {
    const galleryImages = getGalleryImages(product);

    return {
      id: product.id,
      name: product.name,
      category: product.category,
      price_range: product.priceRange,
      dimensions: product.dimensions,
      image_url: product.imageUrl,
      thumbnailUrl: product.thumbnailUrl ?? product.imageUrl,
      thumbnail_url: product.thumbnailUrl ?? product.imageUrl,
      best_for: product.bestFor,
      ...(product.description ? { description: product.description } : {}),
      ...(product.textures ? { textures: product.textures } : {}),
      ...(product.productUrl ? { product_url: product.productUrl } : {}),
      ...(galleryImages.length
        ? {
            imageUrls: galleryImages,
            image_urls: galleryImages,
            galleryImages,
            gallery_images: galleryImages,
          }
        : {}),
      ...(product.shadeImages?.length
        ? {
            shadeImages: product.shadeImages,
            shade_images: product.shadeImages,
          }
        : {}),
    };
  });
}

export class ChannelRendererService {
  renderResponse(plan: ResponsePlan) {
    const serializedProducts = serializeRecommendedProducts(plan.recommendProducts);
    return {
      replyText: plan.reply,
      recommend_products: serializedProducts,
      recommendProducts: serializedProducts as unknown as Product[],
      isMoreImages: plan.isMoreImages,
      isBrowseOnly: plan.isBrowseOnly,
      quickReplies: plan.quickReplies,
      handover: plan.handover,
      triggerType: plan.triggerType,
      promptVersionId: plan.promptVersionId,
      promptVersionLabel: plan.promptVersionLabel,
    };
  }
}
