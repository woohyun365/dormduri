import type { Campus } from '../../generated/prisma/enums.js';
import type { ResolvedCurrentSeasonContext } from '../runtime/current-season-context.query.js';

export interface SeasonContextCacheKey {
  campusCode: Campus;
  referenceNow: Date;
}

export class SeasonContextCache {
  private implicitReferenceNow: Date | null = null;
  private readonly currentSeasonContexts = new Map<string, Promise<ResolvedCurrentSeasonContext>>();

  async resolveReferenceNow(now: Date | undefined, resolver: () => Promise<Date>) {
    if (now) {
      return now;
    }

    if (this.implicitReferenceNow) {
      return this.implicitReferenceNow;
    }

    this.implicitReferenceNow = await resolver();
    return this.implicitReferenceNow;
  }

  getCurrentSeasonContext(key: SeasonContextCacheKey) {
    return this.currentSeasonContexts.get(toSeasonContextCacheKey(key));
  }

  setCurrentSeasonContext(
    key: SeasonContextCacheKey,
    value: Promise<ResolvedCurrentSeasonContext>,
  ) {
    this.currentSeasonContexts.set(toSeasonContextCacheKey(key), value);
    return value;
  }
}

export function createSeasonContextCache() {
  return new SeasonContextCache();
}

function toSeasonContextCacheKey(key: SeasonContextCacheKey) {
  return `${key.campusCode}:${key.referenceNow.toISOString()}`;
}
