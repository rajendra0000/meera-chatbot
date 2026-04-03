export const TEAM_HANDOVER_MESSAGE =
  "Got it. Kabir from our team will take it from here.\nHe'll reach out soon.";

export const HANDOVER_LOCKED_MESSAGE =
  "Kabir will reach out soon.";

const EXPLICIT_HANDOVER_PATTERNS = [
  "call me",
  "have someone call",
  "connect me",
  "connect me to someone",
  "callback",
  "human",
  "agent",
  "sales team",
  "talk to a person",
  "talk to someone",
  "talk to your team",
  "need help from team",
  "can your team help",
  "team se connect",
  "dealer contact",
  "franchise contact",
] as const;

const TEAM_HELP_CUES = [
  "team",
  "someone",
  "person",
  "human",
  "agent",
  "callback",
  "call me",
  "call back",
  "contact me",
  "connect me",
  "help me",
  "help from team",
  "reach out",
  "support",
] as const;

const PURCHASE_SUPPORT_CUES = [
  "order",
  "buy",
  "purchase",
  "dealer",
  "franchise",
  "visit",
  "showroom",
  "quote",
  "pricing",
  "price",
  "sample",
  "project help",
] as const;

const ESCALATION_INTENTS = ["PURCHASE_INTENT", "FAQ", "SMALL_TALK", "FIELD_UPDATE"] as const;

export class HandoverService {
  detectExplicitHandover(message: string) {
    const lowered = message.toLowerCase();
    return EXPLICIT_HANDOVER_PATTERNS.some((keyword) => lowered.includes(keyword));
  }

  detectIntentDrivenHandover(message: string, intent: string) {
    if (!ESCALATION_INTENTS.includes(intent as (typeof ESCALATION_INTENTS)[number])) {
      return false;
    }

    const lowered = message.toLowerCase();
    const hasTeamCue = TEAM_HELP_CUES.some((keyword) => lowered.includes(keyword));
    const hasPurchaseCue = PURCHASE_SUPPORT_CUES.some((keyword) => lowered.includes(keyword));

    return hasTeamCue && hasPurchaseCue;
  }
}
