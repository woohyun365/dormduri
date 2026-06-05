import type { Prisma } from '../../generated/prisma/client.js';
import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';
import { toCompleteLifestyleColumnData } from '../lifestyle/lifestyle-persistence.mapper.js';
import type { CurrentSeasonParticipantRecord } from '../participants/season-participant-records.js';

export function toSeasonProfileHistoryCreateData(
  participant: CurrentSeasonParticipantRecord,
  registeredAt: Date,
): Prisma.SeasonParticipantProfileHistoryUncheckedCreateInput {
  if (!participant.profile) {
    throw seasonParticipantsErrors.registrationSeasonProfileIncomplete();
  }

  return {
    participantId: participant.id,
    seasonId: participant.seasonId,
    nicknameSnapshot: participant.profile.nicknameSnapshot,
    nicknameNormalizedSnapshot: participant.profile.nicknameNormalizedSnapshot,
    ...toCompleteLifestyleColumnData(participant.profile.lifestyle),
    intro: participant.profile.intro,
    collegeCode: participant.profile.collegeCode,
    grade: participant.profile.grade,
    mbti: participant.profile.mbti,
    birthYear: participant.profile.birthYear,
    registeredAtSnapshot: registeredAt,
    source: 'SEASON_REGISTRATION',
  };
}
