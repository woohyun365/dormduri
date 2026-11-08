import { Injectable } from '@nestjs/common';
import type { Prisma } from '@repo/database/client';
import { PrismaService } from '../../platform/database/prisma.service.js';

type AuthSecurityEventClient = Pick<Prisma.TransactionClient, 'authSecurityEvent'>;

@Injectable()
export class AuthSecurityEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.AuthSecurityEventCreateInput,
    client: AuthSecurityEventClient = this.prisma,
  ): Promise<void> {
    await client.authSecurityEvent.create({ data });
  }
}
