import type {
  CurrentSeasonResponse,
  DormitorySeasonOperation,
  SeasonRuntimeOverride,
  SeasonState,
} from '@repo/shared/season-contract';
import type { LocalDateString } from '@repo/shared/date-primitives';
import type { Campus } from '../generated/prisma/enums.js';

export interface CurrentSeasonContext extends CurrentSeasonResponse {
  override: SeasonRuntimeOverride;
}

export interface NormalizedSeasonRuntimeRow {
  id: string;
  campusCode: Campus;
  name: string;
  preparationStartDate: LocalDateString;
  matchingStartDate: LocalDateString;
  seasonEndDate: LocalDateString;
  overrideState: SeasonState | null;
  overrideReason: string | null;
  overrideStartedAt: Date | null;
  overrideEndsAt: Date | null;
  dormitoryOperations: DormitorySeasonOperation[];
}
