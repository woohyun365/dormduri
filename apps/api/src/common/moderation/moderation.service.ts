import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildDefaultModerationRows, toModerationSurfaceValue } from './moderation.defaults.js';
import {
  getErrorMessage,
  matchesModerationTerm,
  normalizeForModeration,
  type ModerationTermEntry,
  type PublicTextSurface,
} from './text-moderation.js';

const MODERATION_CACHE_TTL_MS = 60_000;

interface CachedSurfaceTerms {
  blocked: ModerationTermEntry[];
  reserved: ModerationTermEntry[];
}

@Injectable()
export class ModerationService implements OnModuleInit {
  private cache = new Map<string, { expiresAt: number; terms: CachedSurfaceTerms }>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureDefaultTerms();
  }

  async moderatePublicText(
    value: string,
    surface: PublicTextSurface,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!value.trim()) {
      return { ok: true };
    }

    const terms = await this.getTerms(surface);
    const normalizedValue = normalizeForModeration(value);

    if (terms.blocked.some((term) => matchesModerationTerm(normalizedValue, term))) {
      return {
        ok: false,
        error: getErrorMessage(surface),
      };
    }

    return { ok: true };
  }

  async validateNicknamePolicy(nickname: string): Promise<string | null> {
    const trimmed = nickname.trim();
    if (!trimmed) {
      return '닉네임을 입력해주세요.';
    }

    const terms = await this.getTerms('nickname');
    const normalizedValue = normalizeForModeration(trimmed);

    if (terms.reserved.some((term) => matchesModerationTerm(normalizedValue, term))) {
      return '사용할 수 없는 단어가 포함되어 있습니다.';
    }

    const moderation = await this.moderatePublicText(trimmed, 'nickname');
    if (!moderation.ok) {
      return moderation.error;
    }

    return null;
  }

  private async ensureDefaultTerms() {
    const defaults = buildDefaultModerationRows();
    for (const row of defaults) {
      await this.prisma.moderationTerm.upsert({
        where: {
          normalizedTerm_category_matchMode_surface: {
            normalizedTerm: row.normalizedTerm,
            category: row.category,
            matchMode: row.matchMode,
            surface: row.surface,
          },
        },
        update: {},
        create: row,
      });
    }
  }

  private async getTerms(surface: PublicTextSurface): Promise<CachedSurfaceTerms> {
    const cacheKey = surface;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.terms;
    }

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

    const terms: CachedSurfaceTerms = {
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

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + MODERATION_CACHE_TTL_MS,
      terms,
    });

    return terms;
  }
}
