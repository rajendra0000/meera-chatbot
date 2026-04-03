export const TEAM_HANDOVER_MESSAGE =
  "Nice, I have what I need.\nI'll connect you with Kabir from our team for the next step.";

export const HANDOVER_LOCKED_MESSAGE =
  "Kabir from our team will take it from here.";

export class HandoverService {
  detectExplicitHandover(message: string) {
    const lowered = message.toLowerCase();
    return [
      "call me",
      "connect me",
      "callback",
      "human",
      "agent",
      "sales team",
      "talk to a person",
      "team se connect",
      "franchise",
      "talk to someone",
    ].some((keyword) => lowered.includes(keyword));
  }
}
