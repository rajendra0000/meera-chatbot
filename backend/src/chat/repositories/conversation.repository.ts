import { ChatStep, ConversationChannel, ConversationStatus, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

type DbLike = Prisma.TransactionClient | PrismaClient;

export class ConversationVersionConflictError extends Error {
  constructor(
    readonly conversationId: string,
    readonly expectedVersion: number
  ) {
    super(`Conversation ${conversationId} was updated before version ${expectedVersion} could be saved.`);
    this.name = "ConversationVersionConflictError";
  }
}

export class ConversationRepository {
  constructor(private readonly db: DbLike = prisma) {}

  async findById(id: string) {
    return this.db.conversation.findUnique({ where: { id } });
  }

  async findLatestByContact(contactId: string, channel: ConversationChannel) {
    return this.db.conversation.findFirst({
      where: { contactId, channel },
      orderBy: { updatedAt: "desc" },
    });
  }

  async createConversation(params: { channel: ConversationChannel; contactId?: string }) {
    return this.db.conversation.create({
      data: {
        channel: params.channel,
        contactId: params.contactId,
        step: ChatStep.NAME,
        status: ConversationStatus.ACTIVE,
        collectedData: {},
      },
    });
  }

  async updateConversation(params: {
    id: string;
    customerName: string;
    step: ChatStep;
    status: ConversationStatus;
    collectedData: Prisma.JsonValue;
    expectedVersion: number;
  }) {
    const result = await this.db.conversation.updateMany({
      where: {
        id: params.id,
        version: params.expectedVersion,
      },
      data: {
        customerName: params.customerName,
        step: params.step,
        status: params.status,
        collectedData: params.collectedData as Prisma.InputJsonValue,
        version: {
          increment: 1,
        },
      },
    });

    if (result.count === 0) {
      throw new ConversationVersionConflictError(params.id, params.expectedVersion);
    }

    return {
      id: params.id,
      customerName: params.customerName,
      step: params.step,
      status: params.status,
      collectedData: params.collectedData,
      version: params.expectedVersion + 1,
    };
  }
}
