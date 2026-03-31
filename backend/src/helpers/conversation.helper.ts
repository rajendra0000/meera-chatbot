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
        return "What are you exploring today: wall panels, wall murals, breeze blocks, or brick cladding?";
      case ChatStep.CITY:
        return "Which city are you based in? That helps me guide you better.";
      case ChatStep.BUDGET:
        return "What budget range feels right for this project? You can say Under Rs 200/sqft, Rs 200-400/sqft, Rs 400+/sqft, or Flexible.";
      case ChatStep.AREA:
        return "How much area would you like to cover? You can share the sqft, or just say small, medium, or large.";
      case ChatStep.ROOM_TYPE:
        return "Which room or space is this for?";
      case ChatStep.STYLE:
        return "What kind of look are you leaning toward: minimal, modern, geometric, textured, or something bold?";
      case ChatStep.TIMELINE:
        return "When are you planning to move ahead: this month, 1-3 months, 3-6 months, or just exploring?";
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
