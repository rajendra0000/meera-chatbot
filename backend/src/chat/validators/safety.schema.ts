import { z } from "zod";

export const safetyResultSchema = z.object({
  flags: z.array(z.string()).default([]),
  intentOverride: z.string().nullable().default(null),
  blocked: z.boolean().default(false),
});
