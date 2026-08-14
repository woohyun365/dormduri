import type { Prisma } from '../../generated/prisma/client.js';
import { lifestyleFieldNames } from '../lifestyle/lifestyle-persistence.mapper.js';

/**
 * registration aggregate의 live row 조건이다.
 * DB relation이 없는 SEASON_REGISTRATION snapshot은 caller가 participant id 집합으로
 * 반드시 함께 제한해야 한다.
 */
export function buildRegistrationCompleteParticipantWhere(input: {
  seasonId: string;
  registrationSnapshotParticipantIds: readonly string[];
}): Prisma.SeasonParticipantWhereInput {
  return {
    seasonId: input.seasonId,
    id: { in: [...new Set(input.registrationSnapshotParticipantIds)] },
    participationIntent: 'REGISTERED',
    registeredAt: { not: null },
    declinedAt: null,
    dormitorySelectionState: 'ASSIGNED',
    dormitoryId: { not: null },
    participantStatus: { in: ['ACTIVE', 'MATCHED'] },
    withdrawnAt: null,
    expiredAt: null,
    deactivatedAt: null,
    hiddenByAdminAt: null,
    user: { deletedAt: null },
    profile: { is: buildCompleteSeasonParticipantProfileWhere() },
  };
}

export function buildCompleteSeasonParticipantProfileWhere(): Prisma.SeasonParticipantProfileWhereInput {
  return {
    collegeCode: { not: null },
    birthYear: { not: null },
    grade: { not: null },
    mbti: { not: null },
    ...Object.fromEntries(lifestyleFieldNames.map((field) => [field, { not: null }])),
  };
}
