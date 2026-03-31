import { z } from "zod";

export const fieldUpdateSchema = z.object({
  field: z.enum([
    "name",
    "productType",
    "city",
    "budget",
    "areaSqft",
    "roomType",
    "style",
    "timeline",
  ]),
  value: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.5),
  source: z.enum(["deterministic", "llm"]).default("llm"),
  overwriteMode: z.enum(["if-empty", "overwrite"]).default("if-empty"),
});

export type FieldUpdateSchema = z.infer<typeof fieldUpdateSchema>;
