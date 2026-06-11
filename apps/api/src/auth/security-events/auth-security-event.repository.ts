import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';

@Injectable()
export class AuthSecurityEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.AuthSecurityEventCreateInput): Promise<void> {
    await this.prisma.authSecurityEvent.create({ data });
  }
}
