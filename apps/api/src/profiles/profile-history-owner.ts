import type { Prisma } from '../generated/prisma/client.js';
import { lifestyleColumnSelect } from './profile-lifestyle.persistence.js';

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

export async function appendUserProfileHistorySnapshot(
  tx: Prisma.TransactionClient,
  userId: string,
  source:
    | 'SIGNUP_CREATE'
    | 'USER_EDIT'
    | 'SEASON_REGISTRATION'
    | 'SEASON_USER_EDIT'
    | 'RETENTION_SNAPSHOT'
    | 'SYSTEM_BACKFILL',
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

  await tx.userProfileHistory.create({
    data: {
      ...profile,
      source,
      ...(retainedIdentityId ? { retainedIdentityId } : {}),
    },
  });
}

export async function appendSeasonParticipantProfileHistorySnapshot(
  tx: Prisma.TransactionClient,
  participantId: string,
  source:
    | 'SIGNUP_CREATE'
    | 'USER_EDIT'
    | 'SEASON_REGISTRATION'
    | 'SEASON_USER_EDIT'
    | 'RETENTION_SNAPSHOT'
    | 'SYSTEM_BACKFILL',
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

  await tx.seasonParticipantProfileHistory.create({
    data: {
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
      source,
      ...(retainedIdentityId ? { retainedIdentityId } : {}),
    },
  });
}
