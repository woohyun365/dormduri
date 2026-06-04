import { Injectable } from '@nestjs/common';
import { PrismaService } from '../platform/database/prisma.service.js';
import { toModerationSurfaceValue } from './moderation.defaults.js';
import type { ModerationTermEntry, PublicTextSurface } from './text-moderation.policy.js';

export interface ModerationTermsByCategory {
  blocked: ModerationTermEntry[];
  reserved: ModerationTermEntry[];
}

@Injectable()
export class ModerationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveTerms(surface: PublicTextSurface): Promise<ModerationTermsByCategory> {
    const surfaceValue = toModerationSurfaceValue(surface);
    const rows = await this.prisma.moderationTerm.findMany({
      where: {
        isActive: true,
        surface: { in: ['ALL', surfaceValue] },
      },
      select: {
        normalizedTerm: true,
        matchMode: true,
        category: true,
      },
    });

    return {
      blocked: rows
        .filter((row) => row.category === 'BLOCKED_TEXT')
        .map((row) => ({
          normalizedTerm: row.normalizedTerm,
          matchMode: row.matchMode,
          term: row.normalizedTerm,
        })),
      reserved: rows
        .filter((row) => row.category === 'RESERVED_NICKNAME')
        .map((row) => ({
          normalizedTerm: row.normalizedTerm,
          matchMode: row.matchMode,
          term: row.normalizedTerm,
        })),
    };
  }
}
