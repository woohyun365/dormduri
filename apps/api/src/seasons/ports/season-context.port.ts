import type { CurrentSeasonResponse, SeasonState } from '@repo/shared/season/runtime';
import type { Campus } from '../../generated/prisma/enums.js';
import type { SeasonContextCache } from '../cache/season-context-cache.js';
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
  getCurrentSeason(
    campusCode: Campus,
    now?: Date,
    cache?: SeasonContextCache,
  ): Promise<CurrentSeasonResponse | null>;
  getCurrentSeasonContext(
    campusCode: Campus,
    now?: Date,
    cache?: SeasonContextCache,
  ): Promise<CurrentSeasonContext | null>;
  getCurrentSeasonState(
    campusCode: Campus,
    now?: Date,
    cache?: SeasonContextCache,
  ): Promise<SeasonState | null>;
  getCurrentDormitoryMatchWindow(
    campusCode: Campus,
    dormitoryId: string,
    now?: Date,
    cache?: SeasonContextCache,
  ): Promise<DormitoryMatchWindowContext | null>;
}

export type { CurrentSeasonContext, NormalizedSeasonRuntimeRow, SeasonRuntimeRowInput };
export { createSeasonContextCache, SeasonContextCache } from '../cache/season-context-cache.js';

export {
  getEffectiveSeasonState,
  hasActiveSeasonOverride,
  normalizeSeasonRuntimeRow,
  toCurrentSeasonResponse,
};
