import { ChatStep, ConversationChannel } from "@prisma/client";
import { Product } from "../../types/chat.types.js";
import { CollectedData } from "../../types/conversation.types.js";

export interface ToneConfig {
  preferredAcknowledgements?: string[];
  toneStyle?: string;
  emojiStyle?: string;
  customInstructions?: string;
}

export interface ChatRuntimeDeps {
  groqJsonCompletion: (system: string, user: string) => Promise<string | null>;
  groqTextCompletion: (system: string, user: string) => Promise<string | null>;
  getActivePromptBundle: () => Promise<{
    system: string;
    learning: string;
    combined: string;
    promptVersionId: number | null;
    promptVersionLabel: string | null;
    toneConfig?: ToneConfig | null;
  } | null>;
  searchFaqByKeywords: (userMessage: string) => Promise<Array<{
    id?: string;
    question: string;
    answer: string;
    category?: string;
    keywords?: string;
  }>>;
}

export interface ProcessMessageInput {
  message: string;
  currentStep: ChatStep;
  collectedData: CollectedData;
  history: string[];
  lastRecommendedProductIds: string[];
}

export interface ProcessMessageOutput {
  reply: string;
  nextStep: ChatStep;
  collectedData: CollectedData;
  recommendProducts: Product[];
  isMoreImages: boolean;
  isBrowseOnly: boolean;
  quickReplies: string[];
  handover: boolean;
  triggerType: string | null;
  promptVersionId: number | null;
  promptVersionLabel: string | null;
  replySource?: "deterministic" | "phrased";
  validatorAccepted?: boolean;
  validatorUsed?: boolean;
  validatorReason?: string | null;
}

export interface ProcessChatInput {
  conversationId?: string;
  message?: string;
  channel?: ConversationChannel;
  contactId?: string;
  bootstrap?: boolean;
}
