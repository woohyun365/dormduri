import type { DormitorySelectionState } from '@repo/shared/dormitory';
import type { CurrentSeasonContext } from '../../seasons/ports/season-context.port.js';
import { formatKstDate } from '../../platform/time/kst-date.js';

export interface NormalizedSelectionState {
  dormitoryId: string | null;
  dormitorySelectionState: DormitorySelectionState;
}

export function normalizeSelectionState(input: {
  registered: boolean;
  dormitorySelectionState: DormitorySelectionState;
  dormitoryId: string | null;
}): NormalizedSelectionState {
  if (input.dormitorySelectionState === 'ASSIGNED' && input.dormitoryId) {
    return {
      dormitorySelectionState: 'ASSIGNED',
      dormitoryId: input.dormitoryId,
    };
  }

  if (!input.registered && input.dormitorySelectionState === 'SELECTED' && input.dormitoryId) {
    return {
      dormitorySelectionState: 'SELECTED',
      dormitoryId: input.dormitoryId,
    };
  }

  return {
    dormitorySelectionState: input.registered ? 'UNASSIGNED' : input.dormitorySelectionState,
    dormitoryId: null,
  };
}

export function hasOperatedAssignedDormitory(
  operatedDormitoryIds: ReadonlySet<string>,
  selectionState: DormitorySelectionState,
  dormitoryId: string | null,
): boolean {
  return (
    selectionState === 'ASSIGNED' && dormitoryId !== null && operatedDormitoryIds.has(dormitoryId)
  );
}

export function canCurrentDormitoryMatch(
  seasonContext: Pick<CurrentSeasonContext, 'state' | 'operatedDormitories' | 'schedule'> | null,
  dormitoryId: string | null,
  now: Date,
): boolean {
  if (!seasonContext || !dormitoryId || seasonContext.state !== 'SEASON_MATCHING') {
    return false;
  }

  const dormitory = seasonContext.operatedDormitories.find(
    (item) => item.dormitoryId === dormitoryId,
  );
  if (!dormitory) {
    return false;
  }

  const today = formatKstDate(now);
  return today >= seasonContext.schedule.matchingStart && today <= dormitory.roomSelectionDate;
}
