import { MessageRole, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

type DbLike = Prisma.TransactionClient | PrismaClient;

export class MessageRepository {
  constructor(private readonly db: DbLike = prisma) {}

  async createMessage(params: {
    conversationId: string;
    role: MessageRole;
    content: string;
    metadata?: Prisma.JsonValue;
  }) {
    return this.db.message.create({
      data: {
        conversationId: params.conversationId,
        role: params.role,
        content: params.content,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findRecentMessages(conversationId: string, take = 6) {
    return this.db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  async findMessagesByConversationId(conversationId: string) {
    return this.db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
  }
}
