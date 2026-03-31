export const TEAM_HANDOVER_MESSAGE =
  "I've noted everything down! Let me connect you with Kabir from our team so he can help you finalize the right choice. Expect a call soon.";

export class HandoverService {
  detectExplicitHandover(message: string) {
    const lowered = message.toLowerCase();
    return [
      "call me",
      "connect me",
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
