import { ChatStep } from "@prisma/client";
import { Product } from "../../types/chat.types.js";

export interface RecommendationResult {
  products: Product[];
  exhausted: boolean;
  reason: string | null;
  nextBrowseCursor: string[] | null;
}

export interface ResponsePlan {
  reply: string;
  stepQuestion: string | null;
  nextStep: ChatStep;
  quickReplies: string[];
  recommendProducts: Product[];
  isMoreImages: boolean;
  isBrowseOnly: boolean;
  handover: boolean;
  triggerType: string | null;
  promptVersionId: number | null;
  promptVersionLabel: string | null;
  replySource?: "deterministic" | "phrased";
  validatorAccepted?: boolean;
  validatorUsed?: boolean;
  validatorReason?: string | null;
}

export interface ResponseValidationResult {
  accepted: boolean;
  reason: string | null;
  usedLlmCheck: boolean;
  source: "phrased" | "fallback_approved";
  reply: string;
}
