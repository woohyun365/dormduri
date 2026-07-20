import type { Prisma } from '../../../generated/prisma/client.js';
import {
  publicProfileCompatibilitySchema,
  type PublicProfileCompatibility,
} from '@repo/shared/profile/contract';
import { toLifestyleFromColumns } from '../../../season-participants/lifestyle/lifestyle-persistence.mapper.js';
import { buildPublicProfileCompatibility } from '../../scoring/match-score-projection.js';
import type { SeasonHistoryParticipant } from '../materialization/ended-season-history.loader.js';

export const MATCH_HISTORY_COMPATIBILITY_SCHEMA_VERSION =
  'public-profile-compatibility.v1' as const;

export function buildMatchHistoryCompatibilitySnapshot(
  viewerParticipant: SeasonHistoryParticipant,
  counterpartParticipant: SeasonHistoryParticipant,
): {
  compatibilitySnapshot: PublicProfileCompatibility;
  compatibilitySchemaVersion: typeof MATCH_HISTORY_COMPATIBILITY_SCHEMA_VERSION;
} | null {
  const compatibilitySnapshot = buildPublicProfileCompatibility({
    viewerLifestyle: toLifestyleFromColumns(viewerParticipant.profile),
    targetLifestyle: toLifestyleFromColumns(counterpartParticipant.profile),
    scoreVisible: true,
  });

  if (!compatibilitySnapshot) {
    return null;
  }

  return {
    compatibilitySnapshot,
    compatibilitySchemaVersion: MATCH_HISTORY_COMPATIBILITY_SCHEMA_VERSION,
  };
}

export function toMatchHistoryCompatibilityJson(
  compatibility: PublicProfileCompatibility,
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(compatibility)) as Prisma.InputJsonValue;
}

export function readMatchHistoryCompatibilitySnapshot(input: {
  compatibilitySnapshot: unknown;
  compatibilitySchemaVersion: string | null;
  matchScore: number | null;
}): PublicProfileCompatibility | null {
  if (input.compatibilitySchemaVersion !== MATCH_HISTORY_COMPATIBILITY_SCHEMA_VERSION) {
    return null;
  }

  const parsed = publicProfileCompatibilitySchema.safeParse(input.compatibilitySnapshot);
  if (!parsed.success || parsed.data.overallScore !== input.matchScore) {
    return null;
  }

  return parsed.data;
}
