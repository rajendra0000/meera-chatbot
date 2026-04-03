import { ChatStep } from "@prisma/client";
import { QUICK_REPLIES, REQUIRED_FIELDS, STEP_ORDER, STEP_PROMPTS } from "../constants/steps.constants.js";
import { isVagueConversationValue, normalizeConversationValue } from "../constants/conversation.constants.js";
import { CollectedData } from "../types/conversation.types.js";

const STEP_PROMPT_VARIANTS: Partial<Record<ChatStep, string[]>> = {
  [ChatStep.NAME]: [
    STEP_PROMPTS.NAME,
    "What name should I save for you?",
  ],
  [ChatStep.PRODUCT_TYPE]: [
    STEP_PROMPTS.PRODUCT_TYPE,
    "Which category are you looking at: wall panels, wall murals, breeze blocks, or brick cladding?",
  ],
  [ChatStep.CITY]: [
    STEP_PROMPTS.CITY,
    "Which city is this project in?",
  ],
  [ChatStep.BUDGET]: [
    STEP_PROMPTS.BUDGET,
    "What budget range works for this project? A rough range is fine.",
  ],
  [ChatStep.AREA]: [
    STEP_PROMPTS.AREA,
    "Roughly how much area are you looking to cover?",
  ],
  [ChatStep.ROOM_TYPE]: [
    STEP_PROMPTS.ROOM_TYPE,
    "Which space is this going in?",
  ],
  [ChatStep.STYLE]: [
    STEP_PROMPTS.STYLE,
    "What style do you have in mind: minimal, modern, geometric, textured, or statement?",
  ],
  [ChatStep.TIMELINE]: [
    STEP_PROMPTS.TIMELINE,
    "When are you hoping to start: This Month, 1-3 Months, 3-6 Months, or Just Exploring?",
  ],
};

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

  static getStepQuestionVariants(step: ChatStep): string[] {
    return STEP_PROMPT_VARIANTS[step] ?? [ConversationHelper.getStepQuestion(step)];
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

  static getFieldForStep(step: ChatStep): string | null {
    const match = REQUIRED_FIELDS.find(([, requiredStep]) => requiredStep === step);
    return match?.[0] ?? null;
  }

  static getStepForField(field: string | null | undefined): ChatStep | null {
    if (!field) {
      return null;
    }

    const match = REQUIRED_FIELDS.find(([requiredField]) => requiredField === field);
    return match?.[1] ?? null;
  }

  static isStepFilled(step: ChatStep, collectedData: CollectedData): boolean {
    const field = ConversationHelper.getFieldForStep(step);
    if (!field) {
      return step === ChatStep.COMPLETED;
    }

    const value = collectedData[field];
    if (value === null || value === undefined) return false;
    const normalized = normalizeConversationValue(String(value));
    if (!normalized || normalized === "not captured") return false;
    return !isVagueConversationValue(normalized);
  }
}
