import { ResponsePlan } from "../types/response.types.js";
import { Product } from "../../types/chat.types.js";

function serializeRecommendedProducts(products: Product[]) {
  return products.map((product) => ({
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
    ...(product.galleryImages?.length || product.imageUrls
      ? {
          imageUrls: product.galleryImages ?? (JSON.parse(product.imageUrls ?? "[]") as string[]),
          image_urls: product.galleryImages ?? (JSON.parse(product.imageUrls ?? "[]") as string[]),
          galleryImages: product.galleryImages ?? (JSON.parse(product.imageUrls ?? "[]") as string[]),
          gallery_images: product.galleryImages ?? (JSON.parse(product.imageUrls ?? "[]") as string[]),
        }
      : {}),
    ...(product.shadeImages?.length
      ? {
          shadeImages: product.shadeImages,
          shade_images: product.shadeImages,
        }
      : {}),
  }));
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
