import { z } from "zod";
import { fieldUpdateSchema } from "./field-update.schema.js";

export const intentSchema = z.object({
  intent: z.enum([
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
  ]),
  fieldUpdates: z.array(fieldUpdateSchema).default([]),
  browseOnly: z.boolean().default(false),
  handover: z.boolean().default(false),
});
