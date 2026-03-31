import { ChatStep, ConversationStatus } from "@prisma/client";
import { ConversationHelper } from "../../helpers/conversation.helper.js";
import { CollectedData } from "../../types/conversation.types.js";
import { FieldUpdate, IntentResult } from "../types/intent.types.js";
import { StateTransition } from "../types/state-machine.types.js";

const SKIPPABLE_STEPS = new Set<ChatStep>([ChatStep.CITY, ChatStep.STYLE, ChatStep.TIMELINE]);

export class StateMachineService {
  transition(params: {
    currentStep: ChatStep;
    currentData: CollectedData;
    nextData: CollectedData;
    appliedUpdates: FieldUpdate[];
    rejectedUpdates: FieldUpdate[];
    intent: IntentResult;
    handoverTrigger: string | null;
  }): StateTransition {
    const { currentStep, nextData, appliedUpdates, rejectedUpdates, intent, handoverTrigger } = params;

    if (intent.handover || handoverTrigger) {
      return {
        nextStep: ChatStep.COMPLETED,
        status: ConversationStatus.HANDOVER,
        appliedUpdates,
        rejectedUpdates,
        retryCountDelta: 0,
        handoverTrigger: handoverTrigger ?? "Explicit Team Request",
        browseMode: intent.browseOnly ? "browse_only" : "default",
        collectedData: nextData,
        reason: "handover",
      };
    }

    if (intent.intent === "RESET") {
      return {
        nextStep: currentStep,
        status: currentStep === ChatStep.COMPLETED ? ConversationStatus.COMPLETED : ConversationStatus.ACTIVE,
        appliedUpdates,
        rejectedUpdates,
        retryCountDelta: 0,
        handoverTrigger: null,
        browseMode: "default",
        collectedData: nextData,
        reason: "reset_requested",
      };
    }

    if (intent.intent === "SKIP" && SKIPPABLE_STEPS.has(currentStep)) {
      if (currentStep === ChatStep.CITY && !nextData.city) nextData.city = "Unknown";
      if (currentStep === ChatStep.STYLE && !nextData.style) nextData.style = "Not Sure";
      if (currentStep === ChatStep.TIMELINE && !nextData.timeline) nextData.timeline = "Just Exploring";
    }

    const missingStep = ConversationHelper.getMissingRequiredStep(nextData);
    const staysOnCurrentStep =
      intent.intent === "FAQ" ||
      intent.intent === "IRRELEVANT" ||
      intent.intent === "SMALL_TALK" ||
      intent.intent === "SECURITY_ATTACK" ||
      intent.intent === "EMPTY" ||
      intent.intent === "SPAM" ||
      intent.intent === "INVALID";

    const nextStep = staysOnCurrentStep ? currentStep : missingStep ?? ChatStep.COMPLETED;

    return {
      nextStep,
      status: nextStep === ChatStep.COMPLETED ? ConversationStatus.COMPLETED : ConversationStatus.ACTIVE,
      appliedUpdates,
      rejectedUpdates,
      retryCountDelta: intent.intent === "INVALID" ? 1 : 0,
      handoverTrigger: null,
      browseMode: intent.browseOnly ? "browse_only" : "default",
      collectedData: nextData,
      reason: staysOnCurrentStep ? "stay_on_step" : nextStep === ChatStep.COMPLETED ? "completed" : "advance",
    };
  }
}
