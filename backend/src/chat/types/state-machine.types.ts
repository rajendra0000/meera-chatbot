import { ChatStep, ConversationStatus } from "@prisma/client";
import { CollectedData } from "../../types/conversation.types.js";
import { FieldUpdate } from "./intent.types.js";

export interface StateTransition {
  nextStep: ChatStep;
  status: ConversationStatus;
  appliedUpdates: FieldUpdate[];
  rejectedUpdates: FieldUpdate[];
  retryCountDelta: number;
  handoverTrigger: string | null;
  browseMode: "default" | "browse_only";
  collectedData: CollectedData;
  reason: string;
}
