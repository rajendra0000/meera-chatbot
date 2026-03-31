import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

type DbLike = Prisma.TransactionClient | PrismaClient;

export class ProductRepository {
  constructor(private readonly db: DbLike = prisma) {}

  async findAll() {
    return this.db.product.findMany();
  }

  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.db.product.findMany({ where: { id: { in: ids } } });
  }
}
