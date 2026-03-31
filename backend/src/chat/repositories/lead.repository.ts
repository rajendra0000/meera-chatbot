import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { PreparedLeadUpsert, persistPreparedLead } from "../../services/lead.service.js";

type DbLike = Prisma.TransactionClient | PrismaClient;

export class LeadRepository {
  constructor(private readonly db: DbLike = prisma) {}

  async upsertPreparedLead(plan: PreparedLeadUpsert) {
    return persistPreparedLead({
      plan,
      tx: this.db as Prisma.TransactionClient,
    });
  }

  async findByConversationId(conversationId: string) {
    return this.db.lead.findUnique({
      where: { conversationId },
      include: { leadScore: true },
    });
  }
}
