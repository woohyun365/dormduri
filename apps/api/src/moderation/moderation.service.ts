import { Injectable } from '@nestjs/common';
import { ModerationRepository, type ModerationTermsByCategory } from './moderation.repository.js';
import {
  getErrorMessage,
  matchesModerationTerm,
  normalizeForModeration,
  type PublicTextSurface,
} from './text-moderation.policy.js';

const MODERATION_CACHE_TTL_MS = 60_000;

@Injectable()
export class ModerationService {
  private cache = new Map<string, { expiresAt: number; terms: ModerationTermsByCategory }>();

  constructor(private readonly moderationRepository: ModerationRepository) {}

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
      return getErrorMessage('nickname');
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
    terms: ModerationTermsByCategory,
  ): string | null {
    return terms.blocked.some((term) => matchesModerationTerm(normalizedValue, term))
      ? getErrorMessage(surface)
      : null;
  }

  private async getTerms(surface: PublicTextSurface): Promise<ModerationTermsByCategory> {
    const cacheKey = surface;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.terms;
    }

    const terms = await this.moderationRepository.findActiveTerms(surface);

    this.cache.set(cacheKey, {
      expiresAt: Date.now() + MODERATION_CACHE_TTL_MS,
      terms,
    });

    return terms;
  }
}
