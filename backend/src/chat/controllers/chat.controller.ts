import { Request, Response } from "express";
import { z, ZodError } from "zod";
import { ConversationChannel } from "@prisma/client";
import { processChat } from "../../services/chat.service.js";
import { prisma } from "../../lib/prisma.js";

const chatSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().optional(),
  bootstrap: z.boolean().optional(),
  channel: z.nativeEnum(ConversationChannel).optional(),
  contactId: z.string().optional(),
});

export async function sendMessage(req: Request, res: Response): Promise<void> {
  try {
    const body = chatSchema.parse(req.body);
    const result = await processChat(body);
    res.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Invalid request",
        details: error.errors,
      });
      return;
    }

    console.error("[chat.controller.sendMessage]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getConversationMessages(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversation not found" });
      return;
    }

    res.json({
      conversationId: id,
      step: conversation.step,
      messages: conversation.messages.map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    });
  } catch (error) {
    console.error("[chat.controller.getConversationMessages]", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
