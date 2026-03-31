import { ChatStep } from "@prisma/client";
import { QUICK_REPLIES, REQUIRED_FIELDS, STEP_ORDER, STEP_PROMPTS } from "../constants/steps.constants.js";
import { isVagueConversationValue, normalizeConversationValue } from "../constants/conversation.constants.js";
import { CollectedData } from "../types/conversation.types.js";

export class ConversationHelper {
  static buildAtomicReply(acknowledgment: string, stepQuestion: string | null, showroomMsg: string | null): string {
    const firstLine = [acknowledgment, !showroomMsg ? stepQuestion : null]
      .filter((part) => part && part.trim())
      .join(" ")
      .trim();

    return [firstLine, showroomMsg, showroomMsg ? stepQuestion : null]
      .filter((part) => part && part.trim())
      .join("\n\n");
  }

  static getNextStep(current: ChatStep): ChatStep {
    const index = STEP_ORDER.indexOf(current);
    return STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)];
  }

  static getStepQuestion(step: ChatStep): string {
    switch (step) {
      case ChatStep.NAME:
        return STEP_PROMPTS.NAME;
      case ChatStep.PRODUCT_TYPE:
        return STEP_PROMPTS.PRODUCT_TYPE;
      case ChatStep.CITY:
        return STEP_PROMPTS.CITY;
      case ChatStep.BUDGET:
        return STEP_PROMPTS.BUDGET;
      case ChatStep.AREA:
        return STEP_PROMPTS.AREA;
      case ChatStep.ROOM_TYPE:
        return STEP_PROMPTS.ROOM_TYPE;
      case ChatStep.STYLE:
        return STEP_PROMPTS.STYLE;
      case ChatStep.TIMELINE:
        return STEP_PROMPTS.TIMELINE;
      case ChatStep.COMPLETED:
        return "Here are a few options I'd shortlist for you.";
      default:
        return STEP_PROMPTS.NAME;
    }
  }

  static getMissingRequiredStep(collectedData: CollectedData): ChatStep | null {
    const isFieldMissing = (value: unknown) => {
      if (value === null || value === undefined) return true;
      const normalized = normalizeConversationValue(String(value));
      if (!normalized || normalized === "not captured") return true;
      return isVagueConversationValue(normalized);
    };

    const missing = REQUIRED_FIELDS.find(([field]) => {
      return isFieldMissing(collectedData[field]);
    });
    return missing ? missing[1] : null;
  }

  static getCollectedUserFieldCount(collectedData: CollectedData): number {
    return REQUIRED_FIELDS.filter(([field]) => {
      const value = collectedData[field];
      if (value === null || value === undefined) return false;
      if (typeof value !== "string") return true;
      const trimmed = value.trim();
      return trimmed.length > 0 && trimmed !== "Not captured";
    }).length;
  }

  static getQuickReplies(step: ChatStep): string[] {
    return QUICK_REPLIES[step] ?? [];
  }
}
