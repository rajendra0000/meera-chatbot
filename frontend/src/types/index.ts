export type Product = {
  id: string;
  name: string;
  category: string;
  priceRange?: string;
  price_range?: string;
  dimensions: string;
  imageUrl?: string;
  image_url?: string;
  thumbnailUrl?: string | null;
  thumbnail_url?: string | null;
  bestFor?: string;
  best_for?: string;
  description?: string | null;
  textures?: string | null;
  imageUrls?: string[] | string | null;
  image_urls?: string[];
  galleryImages?: string[] | null;
  gallery_images?: string[];
  shadeImages?: string[] | null;
  shade_images?: string[];
  productUrl?: string | null;
  product_url?: string | null;
};

export type Lead = {
  id: string;
  name: string | null;
  score: number;
  status: "COLD" | "WARM" | "HOT";
  productInterest: string | null;
  customerType: string | null;
  investmentRange: string | null;
  areaSqft: string | null;
  timeline: string | null;
  triggerType: string | null;
  showroomCity: string | null;
  wantsCallback: boolean;
  wantsSample: boolean;
  estimatedOrderValue: number | null;
  createdAt: string;
  updatedAt: string;
  leadScore?: {
    budget: number;
    space: number;
    productInterest: number;
    timeline: number;
    engagement: number;
    total: number;
  } | null;
  conversation?: {
    id: string;
    status?: string | null;
    collectedData?: Record<string, string | number | boolean | undefined> | null;
    messages?: Array<{
      id?: string;
      role: "USER" | "ASSISTANT" | "SYSTEM";
      content: string;
    }>;
  } | null;
};

export type ConversationMessage = {
  role: "USER" | "ASSISTANT";
  content: string;
};

export type ChatResponse = {
  conversationId: string;
  replyText: string;
  handoverMessage?: string;
  nextStep: string;
  collectedData: Record<string, string | number | boolean | undefined>;
  recommendProducts?: Product[];
  recommend_products?: Product[];
  isMoreImages?: boolean;
  isBrowseOnly?: boolean;
  quickReplies: string[];
  handover: boolean;
  triggerType: string | null;
  lead: Lead | null;
  promptVersionId: number | null;
  promptVersionLabel: string | null;
};

export type HistoryResponse = {
  conversationId: string;
  step: string;
  messages: Array<{ role: "USER" | "ASSISTANT"; content: string; createdAt: string }>;
};

export type PromptVersion = {
  id: number;
  type: "SYSTEM" | "LEARNING";
  content: string;
  versionNumber: number;
  isActive: boolean;
  createdAt: string;
};

export type FollowUpLayer = {
  layer: number;
  title: string;
  message: string;
};

export type DashboardStats = {
  totalConversations: number;
  hotLeads: number;
  warmLeads: number;
  avgScore: number;
  mostCommonTrigger: string;
};
