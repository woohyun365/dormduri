import type { CurrentSeasonResponse, SeasonState } from '@repo/shared/season-contract';
import type { Campus } from '../../generated/prisma/enums.js';
import {
  normalizeSeasonRuntimeRow,
  toCurrentSeasonResponse,
} from '../runtime/current-season.mapper.js';
import {
  getEffectiveSeasonState,
  hasActiveSeasonOverride,
} from '../runtime/season-runtime.policy.js';
import type {
  CurrentSeasonContext,
  NormalizedSeasonRuntimeRow,
  SeasonRuntimeRowInput,
} from '../runtime/season-runtime.types.js';

export const SEASON_CONTEXT_PORT = Symbol('SEASON_CONTEXT_PORT');

export interface DormitoryMatchWindowContext {
  dormitoryId: string;
  matchingStartDate: string;
  matchingEndDate: string;
  canMatch: boolean;
}

export interface SeasonContextPort {
  getCurrentSeason(campusCode: Campus, now?: Date): Promise<CurrentSeasonResponse | null>;
  getCurrentSeasonContext(campusCode: Campus, now?: Date): Promise<CurrentSeasonContext | null>;
  getCurrentSeasonState(campusCode: Campus, now?: Date): Promise<SeasonState | null>;
  getCurrentDormitoryMatchWindow(
    campusCode: Campus,
    dormitoryId: string,
    now?: Date,
  ): Promise<DormitoryMatchWindowContext | null>;
}

export type { CurrentSeasonContext, NormalizedSeasonRuntimeRow, SeasonRuntimeRowInput };

export {
  getEffectiveSeasonState,
  hasActiveSeasonOverride,
  normalizeSeasonRuntimeRow,
  toCurrentSeasonResponse,
};
