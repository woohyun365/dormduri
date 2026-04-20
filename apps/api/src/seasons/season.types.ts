import type { CurrentSeasonResponse, SeasonState } from '@repo/shared/season-contract';
import type { IsoDateTimeString, LocalDateString } from '@repo/shared/date-primitives';

export interface SeasonRuntimeOverride {
  active: boolean;
  state: SeasonState | null;
  reason: string | null;
  startedAt: IsoDateTimeString | null;
  endsAt: IsoDateTimeString | null;
}

export interface CurrentSeasonContext extends CurrentSeasonResponse {
  override: SeasonRuntimeOverride;
}

export interface NormalizedSeasonRuntimeRow {
  id: string;
  name: string;
  roomSelectionDate: LocalDateString;
  openStartDate: LocalDateString | null;
  matchStartDate: LocalDateString | null;
  matchEndDate: LocalDateString | null;
  overrideState: SeasonState | null;
  overrideReason: string | null;
  overrideStartedAt: Date | null;
  overrideEndsAt: Date | null;
}
