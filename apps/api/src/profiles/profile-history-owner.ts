import type { Prisma } from '../generated/prisma/client.js';
import { lifestyleColumnSelect } from '../common/lifestyle/lifestyle.persistence.js';

const userProfileHistorySourceSelect = {
  userId: true,
  nickname: true,
  nicknameNormalized: true,
  nicknameChangedAt: true,
  ...lifestyleColumnSelect,
  intro: true,
  messageToRoommate: true,
  collegeCode: true,
  grade: true,
  mbti: true,
  birthYear: true,
} as const;

const userProfileHistoryLatestSelect = {
  id: true,
  retainedIdentityId: true,
  source: true,
  ...userProfileHistorySourceSelect,
} as const;

const seasonParticipantProfileHistorySourceSelect = {
  participantId: true,
  nicknameSnapshot: true,
  nicknameNormalizedSnapshot: true,
  ...lifestyleColumnSelect,
  intro: true,
  messageToRoommate: true,
  collegeCode: true,
  grade: true,
  mbti: true,
  birthYear: true,
  templateSourceUserProfileUpdatedAt: true,
  participant: {
    select: {
      seasonId: true,
    },
  },
} as const;

const seasonParticipantProfileHistoryLatestSelect = {
  id: true,
  retainedIdentityId: true,
  source: true,
  participantId: true,
  seasonId: true,
  nicknameSnapshot: true,
  nicknameNormalizedSnapshot: true,
  ...lifestyleColumnSelect,
  intro: true,
  messageToRoommate: true,
  collegeCode: true,
  grade: true,
  mbti: true,
  birthYear: true,
  templateSourceUserProfileUpdatedAt: true,
} as const;

type ProfileHistorySource =
  | 'SIGNUP_CREATE'
  | 'USER_EDIT'
  | 'SEASON_REGISTRATION'
  | 'SEASON_USER_EDIT'
  | 'RETENTION_SNAPSHOT'
  | 'SYSTEM_BACKFILL';

type UserProfileHistorySnapshot = Omit<
  Prisma.UserProfileHistoryUncheckedCreateInput,
  'id' | 'source' | 'retainedIdentityId' | 'createdAt'
>;

type SeasonParticipantProfileHistorySnapshot = Omit<
  Prisma.SeasonParticipantProfileHistoryUncheckedCreateInput,
  'id' | 'source' | 'retainedIdentityId' | 'createdAt'
>;

export async function appendUserProfileHistorySnapshot(
  tx: Prisma.TransactionClient,
  userId: string,
  source: ProfileHistorySource,
  retainedIdentityId?: string,
) {
  if (!('userProfile' in tx) || !('userProfileHistory' in tx)) {
    return;
  }

  const profile = await tx.userProfile.findUnique({
    where: { userId },
    select: userProfileHistorySourceSelect,
  });

  if (!profile) {
    throw new Error('[profile-history-owner] user profile snapshot source not found');
  }

  const snapshot = toUserProfileHistorySnapshot(profile);
  const latest = await tx.userProfileHistory.findFirst({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: userProfileHistoryLatestSelect,
  });

  if (shouldSkipUserProfileHistoryAppend(snapshot, latest, source, retainedIdentityId ?? null)) {
    return;
  }

  await tx.userProfileHistory.create({
    data: {
      ...snapshot,
      source,
      ...(retainedIdentityId ? { retainedIdentityId } : {}),
    },
  });
}

export async function appendSeasonParticipantProfileHistorySnapshot(
  tx: Prisma.TransactionClient,
  participantId: string,
  source: ProfileHistorySource,
  retainedIdentityId?: string,
) {
  if (!('seasonParticipantProfile' in tx) || !('seasonParticipantProfileHistory' in tx)) {
    return;
  }

  const profile = await tx.seasonParticipantProfile.findUnique({
    where: { participantId },
    select: seasonParticipantProfileHistorySourceSelect,
  });

  if (!profile) {
    throw new Error('[profile-history-owner] season participant profile snapshot source not found');
  }

  const snapshot = toSeasonParticipantProfileHistorySnapshot(profile);
  const latest = await tx.seasonParticipantProfileHistory.findFirst({
    where: { participantId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: seasonParticipantProfileHistoryLatestSelect,
  });

  if (
    shouldSkipSeasonParticipantProfileHistoryAppend(
      snapshot,
      latest,
      source,
      retainedIdentityId ?? null,
    )
  ) {
    return;
  }

  await tx.seasonParticipantProfileHistory.create({
    data: {
      ...snapshot,
      source,
      ...(retainedIdentityId ? { retainedIdentityId } : {}),
    },
  });
}

function toUserProfileHistorySnapshot(
  profile: Prisma.UserProfileGetPayload<{ select: typeof userProfileHistorySourceSelect }>,
): UserProfileHistorySnapshot {
  return {
    userId: profile.userId,
    nickname: profile.nickname,
    nicknameNormalized: profile.nicknameNormalized,
    nicknameChangedAt: profile.nicknameChangedAt,
    bedtime: profile.bedtime,
    wakeTime: profile.wakeTime,
    sleepHabit: profile.sleepHabit,
    sleepEnvironment: profile.sleepEnvironment,
    screenUsage: profile.screenUsage,
    noiseSensitivity: profile.noiseSensitivity,
    smokingBehavior: profile.smokingBehavior,
    indoorEating: profile.indoorEating,
    phoneBehavior: profile.phoneBehavior,
    earphoneUsage: profile.earphoneUsage,
    cleanLevel: profile.cleanLevel,
    drinkingFrequency: profile.drinkingFrequency,
    relationshipStyle: profile.relationshipStyle,
    temperatureSensitivity: profile.temperatureSensitivity,
    smokingTolerance: profile.smokingTolerance,
    phoneTolerance: profile.phoneTolerance,
    earphoneExpectation: profile.earphoneExpectation,
    sleepEnvPreference: profile.sleepEnvPreference,
    screenTolerance: profile.screenTolerance,
    indoorEatingTolerance: profile.indoorEatingTolerance,
    cleanExpectation: profile.cleanExpectation,
    drinkingTolerance: profile.drinkingTolerance,
    intro: profile.intro,
    messageToRoommate: profile.messageToRoommate,
    collegeCode: profile.collegeCode,
    grade: profile.grade,
    mbti: profile.mbti,
    birthYear: profile.birthYear,
  };
}

function toSeasonParticipantProfileHistorySnapshot(
  profile: Prisma.SeasonParticipantProfileGetPayload<{
    select: typeof seasonParticipantProfileHistorySourceSelect;
  }>,
): SeasonParticipantProfileHistorySnapshot {
  return {
    participantId: profile.participantId,
    seasonId: profile.participant.seasonId,
    nicknameSnapshot: profile.nicknameSnapshot,
    nicknameNormalizedSnapshot: profile.nicknameNormalizedSnapshot,
    bedtime: profile.bedtime,
    wakeTime: profile.wakeTime,
    sleepHabit: profile.sleepHabit,
    sleepEnvironment: profile.sleepEnvironment,
    screenUsage: profile.screenUsage,
    noiseSensitivity: profile.noiseSensitivity,
    smokingBehavior: profile.smokingBehavior,
    indoorEating: profile.indoorEating,
    phoneBehavior: profile.phoneBehavior,
    earphoneUsage: profile.earphoneUsage,
    cleanLevel: profile.cleanLevel,
    drinkingFrequency: profile.drinkingFrequency,
    relationshipStyle: profile.relationshipStyle,
    temperatureSensitivity: profile.temperatureSensitivity,
    smokingTolerance: profile.smokingTolerance,
    phoneTolerance: profile.phoneTolerance,
    earphoneExpectation: profile.earphoneExpectation,
    sleepEnvPreference: profile.sleepEnvPreference,
    screenTolerance: profile.screenTolerance,
    indoorEatingTolerance: profile.indoorEatingTolerance,
    cleanExpectation: profile.cleanExpectation,
    drinkingTolerance: profile.drinkingTolerance,
    intro: profile.intro,
    messageToRoommate: profile.messageToRoommate,
    collegeCode: profile.collegeCode,
    grade: profile.grade,
    mbti: profile.mbti,
    birthYear: profile.birthYear,
    templateSourceUserProfileUpdatedAt: profile.templateSourceUserProfileUpdatedAt,
  };
}

function shouldSkipUserProfileHistoryAppend(
  snapshot: UserProfileHistorySnapshot,
  latest: Prisma.UserProfileHistoryGetPayload<{
    select: typeof userProfileHistoryLatestSelect;
  }> | null,
  source: ProfileHistorySource,
  retainedIdentityId: string | null,
) {
  if (!latest) {
    return false;
  }

  if (!sameUserProfileHistorySnapshot(snapshot, latest)) {
    return false;
  }

  if (source !== 'RETENTION_SNAPSHOT') {
    return true;
  }

  return latest.source === source && latest.retainedIdentityId === retainedIdentityId;
}

function shouldSkipSeasonParticipantProfileHistoryAppend(
  snapshot: SeasonParticipantProfileHistorySnapshot,
  latest: Prisma.SeasonParticipantProfileHistoryGetPayload<{
    select: typeof seasonParticipantProfileHistoryLatestSelect;
  }> | null,
  source: ProfileHistorySource,
  retainedIdentityId: string | null,
) {
  if (!latest) {
    return false;
  }

  if (!sameSeasonParticipantProfileHistorySnapshot(snapshot, latest)) {
    return false;
  }

  if (source !== 'RETENTION_SNAPSHOT') {
    return true;
  }

  return latest.source === source && latest.retainedIdentityId === retainedIdentityId;
}

function sameUserProfileHistorySnapshot(
  left: UserProfileHistorySnapshot,
  right: UserProfileHistorySnapshot,
) {
  return (
    left.userId === right.userId &&
    left.nickname === right.nickname &&
    left.nicknameNormalized === right.nicknameNormalized &&
    sameDate(left.nicknameChangedAt, right.nicknameChangedAt) &&
    left.bedtime === right.bedtime &&
    left.wakeTime === right.wakeTime &&
    left.sleepHabit === right.sleepHabit &&
    left.sleepEnvironment === right.sleepEnvironment &&
    left.screenUsage === right.screenUsage &&
    left.noiseSensitivity === right.noiseSensitivity &&
    left.smokingBehavior === right.smokingBehavior &&
    left.indoorEating === right.indoorEating &&
    left.phoneBehavior === right.phoneBehavior &&
    left.earphoneUsage === right.earphoneUsage &&
    left.cleanLevel === right.cleanLevel &&
    left.drinkingFrequency === right.drinkingFrequency &&
    left.relationshipStyle === right.relationshipStyle &&
    left.temperatureSensitivity === right.temperatureSensitivity &&
    left.smokingTolerance === right.smokingTolerance &&
    left.phoneTolerance === right.phoneTolerance &&
    left.earphoneExpectation === right.earphoneExpectation &&
    left.sleepEnvPreference === right.sleepEnvPreference &&
    left.screenTolerance === right.screenTolerance &&
    left.indoorEatingTolerance === right.indoorEatingTolerance &&
    left.cleanExpectation === right.cleanExpectation &&
    left.drinkingTolerance === right.drinkingTolerance &&
    left.intro === right.intro &&
    left.messageToRoommate === right.messageToRoommate &&
    left.collegeCode === right.collegeCode &&
    left.grade === right.grade &&
    left.mbti === right.mbti &&
    left.birthYear === right.birthYear
  );
}

function sameSeasonParticipantProfileHistorySnapshot(
  left: SeasonParticipantProfileHistorySnapshot,
  right: SeasonParticipantProfileHistorySnapshot,
) {
  return (
    left.participantId === right.participantId &&
    left.seasonId === right.seasonId &&
    left.nicknameSnapshot === right.nicknameSnapshot &&
    left.nicknameNormalizedSnapshot === right.nicknameNormalizedSnapshot &&
    left.bedtime === right.bedtime &&
    left.wakeTime === right.wakeTime &&
    left.sleepHabit === right.sleepHabit &&
    left.sleepEnvironment === right.sleepEnvironment &&
    left.screenUsage === right.screenUsage &&
    left.noiseSensitivity === right.noiseSensitivity &&
    left.smokingBehavior === right.smokingBehavior &&
    left.indoorEating === right.indoorEating &&
    left.phoneBehavior === right.phoneBehavior &&
    left.earphoneUsage === right.earphoneUsage &&
    left.cleanLevel === right.cleanLevel &&
    left.drinkingFrequency === right.drinkingFrequency &&
    left.relationshipStyle === right.relationshipStyle &&
    left.temperatureSensitivity === right.temperatureSensitivity &&
    left.smokingTolerance === right.smokingTolerance &&
    left.phoneTolerance === right.phoneTolerance &&
    left.earphoneExpectation === right.earphoneExpectation &&
    left.sleepEnvPreference === right.sleepEnvPreference &&
    left.screenTolerance === right.screenTolerance &&
    left.indoorEatingTolerance === right.indoorEatingTolerance &&
    left.cleanExpectation === right.cleanExpectation &&
    left.drinkingTolerance === right.drinkingTolerance &&
    left.intro === right.intro &&
    left.messageToRoommate === right.messageToRoommate &&
    left.collegeCode === right.collegeCode &&
    left.grade === right.grade &&
    left.mbti === right.mbti &&
    left.birthYear === right.birthYear &&
    sameDate(left.templateSourceUserProfileUpdatedAt, right.templateSourceUserProfileUpdatedAt)
  );
}

function sameDate(left: string | Date | null | undefined, right: string | Date | null | undefined) {
  return toComparableDateMillis(left) === toComparableDateMillis(right);
}

function toComparableDateMillis(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value).getTime();
}
