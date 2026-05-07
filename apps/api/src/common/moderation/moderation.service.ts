import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { toModerationSurfaceValue } from './moderation.defaults.js';
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
export class ModerationService {
  private cache = new Map<string, { expiresAt: number; terms: CachedSurfaceTerms }>();

  constructor(private readonly prisma: PrismaService) {}

  async moderatePublicText(
    value: string,
    surface: PublicTextSurface,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!value.trim()) {
      return { ok: true };
    }

    const terms = await this.getTerms(surface);
    const blockedError = this.getBlockedTextError(normalizeForModeration(value), surface, terms);
    if (blockedError) {
      return {
        ok: false,
        error: blockedError,
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

    const blockedError = this.getBlockedTextError(normalizedValue, 'nickname', terms);
    if (blockedError) {
      return blockedError;
    }

    return null;
  }

  private getBlockedTextError(
    normalizedValue: string,
    surface: PublicTextSurface,
    terms: CachedSurfaceTerms,
  ): string | null {
    return terms.blocked.some((term) => matchesModerationTerm(normalizedValue, term))
      ? getErrorMessage(surface)
      : null;
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
