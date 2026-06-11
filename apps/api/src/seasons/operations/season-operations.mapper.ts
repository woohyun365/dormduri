import type { SeasonOperationResponse } from '@repo/shared/season/operations';
import type { SeasonRuntimeOverride } from '@repo/shared/season/runtime';
import { toDateOnlyString, toIsoDateTimeString } from '@repo/shared/date';
import type { Season, SeasonOperationAuditAction } from '../../generated/prisma/client.js';

export type SeasonOperationSnapshotSource = Pick<
  Season,
  | 'id'
  | 'campusCode'
  | 'name'
  | 'preparationStartDate'
  | 'matchingStartDate'
  | 'seasonEndDate'
  | 'updatedAt'
  | 'overrideState'
  | 'overrideReason'
  | 'overrideStartedAt'
  | 'overrideEndsAt'
>;

export function toSeasonOperationsSnapshot(season: SeasonOperationSnapshotSource) {
  return {
    campusCode: season.campusCode,
    season: {
      id: season.id,
      name: season.name,
      preparationStartDate: toDateOnlyString(season.preparationStartDate),
      matchingStartDate: toDateOnlyString(season.matchingStartDate),
      seasonEndDate: toDateOnlyString(season.seasonEndDate),
    },
    updatedAt: toIsoDateTimeString(season.updatedAt),
    override: toSeasonOperationOverrideSnapshot(season),
  };
}

export function toSeasonOperationResponse(input: {
  season: SeasonOperationSnapshotSource;
  auditEventId: string;
  action: SeasonOperationAuditAction;
}): SeasonOperationResponse {
  return {
    season: toSeasonOperationsSnapshot(input.season),
    auditEventId: input.auditEventId,
    action: input.action,
  };
}

function toSeasonOperationOverrideSnapshot(
  season: SeasonOperationSnapshotSource,
): SeasonRuntimeOverride {
  const hasOverride = season.overrideState !== null;

  return {
    active: hasOverride,
    state: season.overrideState,
    reason: season.overrideReason,
    startedAt: season.overrideStartedAt ? toIsoDateTimeString(season.overrideStartedAt) : null,
    endsAt: season.overrideEndsAt ? toIsoDateTimeString(season.overrideEndsAt) : null,
  };
}
