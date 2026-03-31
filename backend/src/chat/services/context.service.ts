import { ChatStep, ConversationStatus, MessageRole } from "@prisma/client";
import { CollectedData } from "../../types/conversation.types.js";
import { ConversationSnapshot } from "../types/conversation.types.js";

function getOriginalKey(field: string) {
  return `_original${field.charAt(0).toUpperCase()}${field.slice(1)}`;
}

export class ContextService {
  buildSnapshot(params: {
    currentStep: ChatStep;
    collectedData: CollectedData;
    history: string[];
    lastRecommendedProductIds: string[];
  }): ConversationSnapshot {
    const originals: Partial<Record<string, string>> = {};
    for (const key of ["productType", "city", "budget", "areaSqft", "roomType", "style", "timeline"]) {
      const originalValue = params.collectedData[getOriginalKey(key)];
      if (typeof originalValue === "string" && originalValue.trim()) {
        originals[key] = originalValue;
      }
    }

    return {
      conversationId: "in-memory",
      status: ConversationStatus.ACTIVE,
      currentStep: params.currentStep,
      collected: { ...params.collectedData },
      originals,
      pending: {
        pendingImageMode: params.collectedData.pendingImageMode,
        pendingImageProductIds: params.collectedData.pendingImageProductIds,
        pendingImageCategory: params.collectedData.pendingImageCategory,
        pendingImageProductName: params.collectedData.pendingImageProductName,
        pendingImageRequestedProductId: params.collectedData.pendingImageRequestedProductId,
      },
      shownProductIds: params.collectedData.shownProductIds ?? params.lastRecommendedProductIds,
      recentMessages: params.history.map((item) => {
        const separator = item.indexOf(":");
        const rolePrefix = separator >= 0 ? item.slice(0, separator).trim().toLowerCase() : "assistant";
        const content = separator >= 0 ? item.slice(separator + 1).trim() : item;
        return {
          role: rolePrefix.includes("user") ? MessageRole.USER : MessageRole.ASSISTANT,
          content,
          metadata: null,
        };
      }),
    };
  }
}
