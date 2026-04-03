import { groqJsonCompletion, groqTextCompletion } from "../lib/groq.js";
import { getActivePromptBundle } from "./prompt.service.js";
import { searchFaqByKeywords } from "./faq.service.js";
import { ConversationService } from "../chat/services/conversation.service.js";
import { ChatRuntimeDeps } from "../chat/types/chat.types.js";
import { ChatInput, ProcessMessageResult } from "../types/chat.types.js";
import { CollectedData } from "../types/conversation.types.js";
import { ChatStep } from "@prisma/client";

const defaultChatServiceDeps: ChatRuntimeDeps = {
  groqJsonCompletion,
  groqTextCompletion,
  getActivePromptBundle,
  searchFaqByKeywords,
};

const chatServiceDeps: ChatRuntimeDeps = { ...defaultChatServiceDeps };

function getConversationService() {
  return new ConversationService(chatServiceDeps);
}

export async function processMessage(params: {
  message: string;
  currentStep: ChatStep;
  collectedData: CollectedData;
  history: string[];
  lastRecommendedProductIds: string[];
  postHandoffMode?: boolean;
}): Promise<ProcessMessageResult> {
  return getConversationService().processMessage(params);
}

export async function processChat(input: ChatInput) {
  return getConversationService().processChat(input);
}

export function __setChatServiceDepsForTests(overrides: Partial<ChatRuntimeDeps>) {
  Object.assign(chatServiceDeps, overrides);
}

export function __resetChatServiceDepsForTests() {
  Object.assign(chatServiceDeps, defaultChatServiceDeps);
}
