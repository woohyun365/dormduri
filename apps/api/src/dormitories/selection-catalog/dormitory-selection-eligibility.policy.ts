import { toDateOnlyString } from '@repo/shared/date';
import type { DormitoryGenderPolicy, Gender } from '../../generated/prisma/enums.js';
import type { CurrentSeasonContext } from '../../seasons/ports/season-context.port.js';
import { formatKstDate } from '../../platform/time/kst-date.js';

export function isDormitoryGenderCompatible(gender: Gender, genderPolicy: DormitoryGenderPolicy) {
  return genderPolicy === 'BOTH' || genderPolicy === gender;
}

export function isDormitoryRoomSelectionClosed(
  seasonContext: CurrentSeasonContext,
  roomSelectionDate: Date,
  now: Date,
) {
  return (
    seasonContext.state === 'SEASON_MATCHING' &&
    formatKstDate(now) > toDateOnlyString(roomSelectionDate)
  );
}
