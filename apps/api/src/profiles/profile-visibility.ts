import type { SeasonState } from '@repo/shared/season-contract';
import type { DormitorySelectionState } from '@repo/shared/dormitory-contract';

export type ProfileVisibilityScope =
  | { type: 'none' }
  | { type: 'same-campus' }
  | { type: 'same-dormitory'; dormitoryId: string };

export function resolveProfileVisibilityScope(input: {
  campusOperated: boolean;
  seasonState: SeasonState | null;
  selectionState: DormitorySelectionState;
  dormitoryId: string | null;
}): ProfileVisibilityScope {
  if (!input.campusOperated) {
    return { type: 'same-campus' };
  }

  if (input.seasonState === 'OFF_SEASON') {
    return { type: 'same-campus' };
  }

  if (input.selectionState !== 'ASSIGNED' || !input.dormitoryId) {
    return { type: 'none' };
  }

  return { type: 'same-dormitory', dormitoryId: input.dormitoryId };
}
