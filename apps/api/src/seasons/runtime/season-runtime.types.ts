import type {
  CurrentSeasonResponse,
  DormitorySeasonOperation,
  SeasonRuntimeOverride,
  SeasonState,
} from '@repo/shared/season/runtime';
import type { LocalDateString } from '@repo/shared/date-primitives';
import type { Campus } from '../../generated/prisma/enums.js';

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

export type SeasonWindowSource = {
  preparationStartDate: LocalDateString;
  matchingStartDate: LocalDateString;
  seasonEndDate: LocalDateString;
  dormitoryOperations: Array<{
    dormitoryId: string;
    isOperated: boolean;
    roomSelectionDate: LocalDateString;
  }>;
};

export type SeasonOverrideSource = {
  overrideState?: SeasonState | null;
  overrideStartedAt?: Date | string | null;
  overrideEndsAt?: Date | string | null;
};

export type SeasonRuntimeRowInput = {
  id: string;
  campusCode: NormalizedSeasonRuntimeRow['campusCode'];
  name: string;
  preparationStartDate: Date | string;
  matchingStartDate: Date | string;
  seasonEndDate: Date | string;
  overrideState?: SeasonState | null;
  overrideReason?: string | null;
  overrideStartedAt?: Date | null;
  overrideEndsAt?: Date | null;
  dormitoryOperations?: Array<{
    dormitoryId: string;
    isOperated: boolean;
    roomSelectionDate: Date | string;
  }>;
};
