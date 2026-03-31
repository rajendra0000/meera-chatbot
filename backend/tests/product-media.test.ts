import assert from "node:assert/strict";
import test from "node:test";
import { ChatStep } from "@prisma/client";
import { ChannelRendererService } from "../src/chat/services/channel-renderer.service.js";
import { resolveProductMedia } from "../src/helpers/product-media.helper.js";
import { Product } from "../src/types/chat.types.js";

test("resolveProductMedia keeps only real gallery images in the renderable set", () => {
  const media = resolveProductMedia({
    imageUrl: "https://heyconcrete.com/wp-content/uploads/2024/07/Plain.webp",
    imageUrls: JSON.stringify([
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp",
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-detail.webp",
      "https://heyconcrete.com/wp-content/uploads/2024/07/Plain.webp",
      "https://heyconcrete.com/wp-content/uploads/2024/07/Porous.webp",
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-dimensions.webp",
    ]),
  });

  assert.equal(media.thumbnailUrl, "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp");
  assert.deepEqual(media.galleryImages, [
    "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp",
    "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-detail.webp",
  ]);
  assert.deepEqual(media.shadeImages, [
    "https://heyconcrete.com/wp-content/uploads/2024/07/Plain.webp",
    "https://heyconcrete.com/wp-content/uploads/2024/07/Porous.webp",
  ]);
});

test("ChannelRendererService exposes separated thumbnail, gallery, and shade assets", () => {
  const renderer = new ChannelRendererService();
  const product: Product = {
    id: "furrow",
    name: "Furrow",
    category: "Wall Panels (H-UHPC)",
    priceRange: "Rs 400+/sqft",
    dimensions: "Panel based",
    imageUrl: "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp",
    thumbnailUrl: "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp",
    bestFor: "Feature walls",
    imageUrls: JSON.stringify([
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp",
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-detail.webp",
    ]),
    galleryImages: [
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp",
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-detail.webp",
    ],
    shadeImages: [
      "https://heyconcrete.com/wp-content/uploads/2024/07/Plain.webp",
      "https://heyconcrete.com/wp-content/uploads/2024/07/Porous.webp",
    ],
    productUrl: "https://example.com/furrow",
  };

  const response = renderer.renderResponse({
    reply: "A few options I'd shortlist for you are below.",
    stepQuestion: null,
    nextStep: ChatStep.COMPLETED,
    quickReplies: [],
    recommendProducts: [product],
    isMoreImages: false,
    isBrowseOnly: false,
    handover: false,
    triggerType: null,
    promptVersionId: null,
    promptVersionLabel: null,
  });

  assert.deepEqual(response.recommend_products[0], {
    id: "furrow",
    name: "Furrow",
    category: "Wall Panels (H-UHPC)",
    price_range: "Rs 400+/sqft",
    dimensions: "Panel based",
    image_url: "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp",
    thumbnailUrl: "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp",
    thumbnail_url: "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp",
    best_for: "Feature walls",
    product_url: "https://example.com/furrow",
    imageUrls: [
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp",
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-detail.webp",
    ],
    image_urls: [
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp",
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-detail.webp",
    ],
    galleryImages: [
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp",
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-detail.webp",
    ],
    gallery_images: [
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-main.webp",
      "https://heyconcrete.com/wp-content/uploads/2024/08/furrow-detail.webp",
    ],
    shadeImages: [
      "https://heyconcrete.com/wp-content/uploads/2024/07/Plain.webp",
      "https://heyconcrete.com/wp-content/uploads/2024/07/Porous.webp",
    ],
    shade_images: [
      "https://heyconcrete.com/wp-content/uploads/2024/07/Plain.webp",
      "https://heyconcrete.com/wp-content/uploads/2024/07/Porous.webp",
    ],
  });
});
