import { z } from "zod";

export const responsePhraseSchema = z.object({
  reply: z.string().min(1),
});
