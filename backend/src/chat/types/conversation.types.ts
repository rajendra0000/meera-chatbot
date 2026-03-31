import { ChatStep, ConversationStatus, MessageRole } from "@prisma/client";
import { CollectedData } from "../../types/conversation.types.js";

export interface RecentMessage {
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown> | null;
}

export interface ConversationSnapshot {
  conversationId: string;
  status: ConversationStatus;
  currentStep: ChatStep;
  collected: CollectedData;
  originals: Partial<Record<string, string>>;
  pending: Record<string, unknown>;
  shownProductIds: string[];
  recentMessages: RecentMessage[];
  concurrencyToken?: string;
}

export interface DecisionTrace {
  intent: string;
  safetyFlags: string[];
  transitionReason: string;
  faqIds: string[];
  productIds: string[];
  fallbackUsed: boolean;
  llmFailures: string[];
}
