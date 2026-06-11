import type { Campus } from '../../generated/prisma/enums.js';
import type { ResolvedCurrentSeasonContext } from '../runtime/current-season-context.query.js';
import type { SeasonContextCache } from './season-context-cache.js';

export async function resolveSeasonReferenceNow(input: {
  cache?: SeasonContextCache;
  now?: Date;
  resolveReferenceNow: () => Promise<Date>;
}) {
  return input.cache
    ? input.cache.resolveReferenceNow(input.now, input.resolveReferenceNow)
    : input.resolveReferenceNow();
}

export function resolveMemoizedCurrentSeasonContext(input: {
  cache?: SeasonContextCache;
  campusCode: Campus;
  referenceNow: Date;
  load: () => Promise<ResolvedCurrentSeasonContext>;
}) {
  if (!input.cache) {
    return input.load();
  }

  const key = {
    campusCode: input.campusCode,
    referenceNow: input.referenceNow,
  };
  const cached = input.cache.getCurrentSeasonContext(key);

  if (cached) {
    return cached;
  }

  return input.cache.setCurrentSeasonContext(key, input.load());
}
