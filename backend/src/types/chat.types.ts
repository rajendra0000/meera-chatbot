import { ConversationChannel } from "@prisma/client";
import { CollectedData } from "./conversation.types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Chat API types
// ─────────────────────────────────────────────────────────────────────────────

export interface ChatInput {
  conversationId?: string;
  message?: string;
  channel?: ConversationChannel;
  contactId?: string;
  bootstrap?: boolean;
}

export interface Product {
  id: string;
  name: string;
  priceRange: string;
  dimensions: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  category: string;
  bestFor: string;
  description?: string | null;
  textures?: string | null;
  imageUrls?: string | null;
  galleryImages?: string[];
  shadeImages?: string[];
  productUrl?: string | null;
}

export interface SerializedProduct {
  id: string;
  name: string;
  category: string;
  price_range: string;
  dimensions: string;
  image_url: string;
  thumbnailUrl?: string | null;
  thumbnail_url?: string | null;
  best_for: string;
  imageUrls?: string[] | null;
  galleryImages?: string[];
  gallery_images?: string[];
  shadeImages?: string[];
  shade_images?: string[];
  description?: string | null;
  textures?: string | null;
  product_url?: string | null;
  image_urls?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM response type (single combined Groq call)
// ─────────────────────────────────────────────────────────────────────────────

export interface LLMResponse {
  messageType: string;
  reply: string;
  reply_text?: string;
  extractedField?: string | null;
  extractedValue: string | null;
  switchIntent?: "CONFIRMED_SWITCH" | "BROWSING" | "AMBIGUOUS" | null;
  nextStep: string;
  next_step?: string;
  recommendProductIds: string[];
  recommend_products?: Array<{ id: string }>;
  handover: boolean;
  quick_replies?: string[];
  trigger_type?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal processMessage result
// ─────────────────────────────────────────────────────────────────────────────

export interface ProcessMessageResult {
  reply: string;
  nextStep: import("@prisma/client").ChatStep;
  collectedData: CollectedData;
  recommendProducts: Product[];
  isMoreImages: boolean;
  isBrowseOnly: boolean;
  quickReplies: string[];
  handover: boolean;
  triggerType: string | null;
  promptVersionId: number | null;
  promptVersionLabel: string | null;
}
