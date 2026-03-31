export const CHAT_INTENTS = [
  "STEP_ANSWER",
  "FAQ",
  "SHOW_PRODUCTS",
  "MORE_PRODUCTS",
  "MORE_IMAGES",
  "HANDOVER",
  "RESET",
  "SKIP",
  "FIELD_UPDATE",
  "SMALL_TALK",
  "EMPTY",
  "SPAM",
  "INVALID",
  "SECURITY_ATTACK",
  "GREETING",
  "IRRELEVANT",
] as const;

export type ChatIntent = (typeof CHAT_INTENTS)[number];

export type MutableConversationField =
  | "productType"
  | "city"
  | "budget"
  | "areaSqft"
  | "roomType"
  | "style"
  | "timeline";

export type ExtractableConversationField = MutableConversationField | "name";

export interface FieldUpdate {
  field: ExtractableConversationField;
  value: string;
  confidence: number;
  source: "deterministic" | "llm";
  overwriteMode: "if-empty" | "overwrite";
}

export interface IntentResult {
  intent: ChatIntent;
  confidence: number;
  fieldUpdates: FieldUpdate[];
  browseOnly: boolean;
  handover: boolean;
  fallbackUsed: boolean;
  llmFailures: string[];
  notes: string[];
}
