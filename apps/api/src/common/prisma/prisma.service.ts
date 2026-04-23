import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import { getCurrentTimestamp } from '../../generated/prisma/sql.js';
import { apiEnv } from '../../config/env.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: apiEnv.databaseUrl }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async getDatabaseNow(): Promise<Date> {
    const [row] = await this.$queryRawTyped(getCurrentTimestamp());

    if (!row?.now) {
      throw new Error('[PrismaService] failed to resolve database current timestamp');
    }

    return row.now instanceof Date ? row.now : new Date(row.now);
  }
}
