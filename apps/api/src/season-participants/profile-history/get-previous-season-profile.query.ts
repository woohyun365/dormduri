import type { PreviousSeasonProfileResponse } from '@repo/shared/season/participation';
import type { Prisma } from '../../generated/prisma/client.js';
import { formatKstDate } from '../../platform/time/kst-date.js';
import { getVerifiedUserForSeasonAction } from '../application/season-action-user.query.js';
import type { SeasonParticipantUseCaseDeps } from '../application/season-participant-use-case.deps.js';
import {
  currentSeasonParticipantProfileSelect,
  toAdditionalProfileFromRecord,
} from '../participants/season-participant-records.js';
import {
  lifestyleColumnSelect,
  toLifestyleFromColumns,
} from '../lifestyle/lifestyle-persistence.mapper.js';

const previousSeasonParticipantSelect = {
  id: true,
  seasonId: true,
  dormitoryId: true,
  registeredAt: true,
  profile: {
    select: currentSeasonParticipantProfileSelect,
  },
  dormitory: {
    select: {
      nameKo: true,
    },
  },
  season: {
    select: {
      id: true,
      name: true,
      seasonEndDate: true,
      matchingStartDate: true,
      createdAt: true,
    },
  },
} satisfies Prisma.SeasonParticipantSelect;

const previousSeasonProfileHistorySelect = {
  id: true,
  participantId: true,
  seasonId: true,
  ...lifestyleColumnSelect,
  intro: true,
  collegeCode: true,
  grade: true,
  mbti: true,
  birthYear: true,
  registeredAtSnapshot: true,
  createdAt: true,
} satisfies Prisma.SeasonParticipantProfileHistorySelect;

type PreviousSeasonParticipantRow = Prisma.SeasonParticipantGetPayload<{
  select: typeof previousSeasonParticipantSelect;
}>;

type PreviousSeasonProfileHistoryRow = Prisma.SeasonParticipantProfileHistoryGetPayload<{
  select: typeof previousSeasonProfileHistorySelect;
}>;

export function createGetPreviousSeasonProfileQuery(deps: SeasonParticipantUseCaseDeps) {
  async function getPreviousSeasonProfile(
    userId: string,
    now?: Date,
  ): Promise<PreviousSeasonProfileResponse> {
    const referenceNow = now ?? (await deps.prisma.getDatabaseNow());
    const user = await getVerifiedUserForSeasonAction(deps, userId);
    const today = formatKstDate(referenceNow);
    const todayDate = new Date(`${today}T00:00:00.000Z`);

    const participant = await deps.prisma.seasonParticipant.findFirst({
      where: {
        userId: user.id,
        registeredAt: { not: null },
        season: {
          campusCode: user.campus,
          seasonEndDate: { lt: todayDate },
        },
      },
      orderBy: [
        { season: { seasonEndDate: 'desc' } },
        { season: { matchingStartDate: 'desc' } },
        { registeredAt: 'desc' },
        { createdAt: 'desc' },
      ],
      select: previousSeasonParticipantSelect,
    });

    if (!participant) {
      return {
        detailState: 'EMPTY',
        reason: 'NO_PREVIOUS_SEASON_PROFILE',
        message: '직전 시즌에 확인할 수 있는 내 시즌 프로필이 없어요.',
      };
    }

    const history = await deps.prisma.seasonParticipantProfileHistory.findFirst({
      where: {
        participantId: participant.id,
        seasonId: participant.seasonId,
        redactedAt: null,
      },
      orderBy: [{ registeredAtSnapshot: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: previousSeasonProfileHistorySelect,
    });

    if (history) {
      return toPreviousSeasonProfileFromHistory(participant, history);
    }

    if (participant.profile) {
      return toPreviousSeasonProfileFromParticipantProfile(participant);
    }

    return {
      detailState: 'EMPTY',
      reason: 'PROFILE_NOT_AVAILABLE',
      message: '직전 시즌 프로필 상세 정보를 더 이상 확인할 수 없어요.',
    };
  }

  return { getPreviousSeasonProfile };
}

export type GetPreviousSeasonProfileQuery = ReturnType<typeof createGetPreviousSeasonProfileQuery>;

function toPreviousSeasonProfileFromHistory(
  participant: PreviousSeasonParticipantRow,
  history: PreviousSeasonProfileHistoryRow,
): PreviousSeasonProfileResponse {
  const lifestyle = toLifestyleFromColumns(history);
  if (!lifestyle) {
    return {
      detailState: 'EMPTY',
      reason: 'PROFILE_NOT_AVAILABLE',
      message: '직전 시즌 프로필 상세 정보를 더 이상 확인할 수 없어요.',
    };
  }

  return {
    detailState: 'FULL',
    participantId: participant.id,
    seasonId: participant.seasonId,
    seasonName: participant.season.name,
    dormitoryId: participant.dormitoryId,
    dormitoryName: participant.dormitory?.nameKo ?? null,
    state: 'REGISTRATION_FINALIZED',
    lifestyle,
    intro: history.intro,
    additional: toAdditionalProfileFromRecord(history),
    completion: readOnlyCompletedProfileCompletion(),
    draftWritable: false,
    registeredAt: (history.registeredAtSnapshot ?? participant.registeredAt)?.toISOString() ?? null,
    profileSnapshotAt: history.createdAt.toISOString(),
  };
}

function toPreviousSeasonProfileFromParticipantProfile(
  participant: PreviousSeasonParticipantRow,
): PreviousSeasonProfileResponse {
  if (!participant.profile) {
    return {
      detailState: 'EMPTY',
      reason: 'PROFILE_NOT_AVAILABLE',
      message: '직전 시즌 프로필 상세 정보를 더 이상 확인할 수 없어요.',
    };
  }

  const lifestyle = toLifestyleFromColumns(participant.profile);
  if (!lifestyle) {
    return {
      detailState: 'EMPTY',
      reason: 'PROFILE_NOT_AVAILABLE',
      message: '직전 시즌 프로필 상세 정보를 더 이상 확인할 수 없어요.',
    };
  }

  return {
    detailState: 'FULL',
    participantId: participant.id,
    seasonId: participant.seasonId,
    seasonName: participant.season.name,
    dormitoryId: participant.dormitoryId,
    dormitoryName: participant.dormitory?.nameKo ?? null,
    state: 'REGISTRATION_FINALIZED',
    lifestyle,
    intro: participant.profile.intro,
    additional: toAdditionalProfileFromRecord(participant.profile),
    completion: readOnlyCompletedProfileCompletion(),
    draftWritable: false,
    registeredAt: participant.registeredAt?.toISOString() ?? null,
    profileSnapshotAt: participant.profile.updatedAt.toISOString(),
  };
}

function readOnlyCompletedProfileCompletion() {
  return {
    profileCompletionRequired: false,
    dormitorySelectionRequired: false,
    registrationUnavailable: false,
    registrationUnavailableReasons: [],
  };
}
