import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

type DbLike = Prisma.TransactionClient | PrismaClient;

export class FaqRepository {
  constructor(private readonly db: DbLike = prisma) {}

  async findAll() {
    return this.db.faqEntry.findMany();
  }
}
