import type { SeasonProfileDraftRequest } from '@repo/shared/season-contract';
import { SeasonParticipantsService } from './season-participants.service.js';
import { toLifestyleColumnData } from '../profiles/profile-lifestyle.persistence.js';

export const now = new Date('2026-02-10T03:00:00.000Z');

export function objectContaining(shape: Record<string, unknown>): unknown {
  return expect.objectContaining(shape) as unknown;
}

export function anyObject(): unknown {
  return expect.any(Object) as unknown;
}

export const completeLifestyle = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'NORMAL',
  smokingBehavior: 'NO',
  indoorEating: 'SNACK',
  phoneBehavior: 'SOMETIMES',
  earphoneUsage: 'MOSTLY',
  cleanLevel: 'WEEKLY_3_UP',
  drinkingFrequency: 'NONE',
  relationshipStyle: 'CLOSE',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'NO_ONLY',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'MUST',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
  indoorEatingTolerance: 'NO_SMELL',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
} as const;

export const draftInput: SeasonProfileDraftRequest = {
  lifestyle: completeLifestyle,
  intro: '시즌 소개',
  additional: {
    college: 'ARTS_ENGINEERING',
    grade: '3',
    mbti: 'INTJ',
    birthYear: 2002,
  },
};

export function seasonContext(overrides: Record<string, unknown> = {}) {
  return {
    season: { id: 'season-1' },
    state: 'SEASON_OPEN',
    operatedDormitories: [
      { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-20' },
    ],
    schedule: {
      preparationStart: '2026-01-01',
      matchingStart: '2026-02-01',
      matchingEnd: '2026-02-20',
      seasonEnd: '2026-03-01',
    },
    ...overrides,
  };
}

export function seasonRuntimeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'season-1',
    campusCode: 'CHUNCHEON',
    name: '2026-1',
    preparationStartDate: new Date('2026-01-01T00:00:00.000Z'),
    matchingStartDate: new Date('2026-02-01T00:00:00.000Z'),
    seasonEndDate: new Date('2026-03-01T00:00:00.000Z'),
    overrideState: null,
    overrideReason: null,
    overrideStartedAt: null,
    overrideEndsAt: null,
    createdAt: now,
    dormitoryOperations: [
      {
        dormitoryId: 'dasan',
        isOperated: true,
        roomSelectionDate: new Date('2026-02-20T00:00:00.000Z'),
      },
    ],
    ...overrides,
  };
}

export function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    campus: 'CHUNCHEON',
    gender: 'M',
    emailVerifiedAt: now,
    deletedAt: null,
    displayIdentity: {
      userId: 'user-1',
      nickname: '현재닉네임',
      nicknameNormalized: '현재닉네임',
    },
    ...overrides,
  };
}

export function profile(overrides: Record<string, unknown> = {}) {
  return {
    participantId: 'participant-1',
    nicknameSnapshot: '현재닉네임',
    nicknameNormalizedSnapshot: '현재닉네임',
    ...toLifestyleColumnData(completeLifestyle),
    intro: '시즌 소개',
    collegeCode: 'ARTS_ENGINEERING',
    grade: '3',
    mbti: 'INTJ',
    birthYear: 2002,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function participant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'participant-1',
    seasonId: 'season-1',
    userId: 'user-1',
    participationIntent: 'UNDECIDED',
    registeredAt: null,
    declinedAt: null,
    dormitoryId: null,
    dormitorySelectionState: 'NOT_SELECTED',
    participantStatus: 'NOT_STARTED',
    campusCodeSnapshot: 'CHUNCHEON',
    genderSnapshot: 'M',
    joinedAt: now,
    activatedAt: null,
    matchedAt: null,
    withdrawnAt: null,
    expiredAt: null,
    hiddenByAdminAt: null,
    hiddenReasonCode: null,
    hiddenReasonDetail: null,
    deactivatedAt: null,
    createdAt: now,
    updatedAt: now,
    profile: null,
    ...overrides,
  };
}

export function currentProfile(overrides: Record<string, unknown> = {}) {
  return {
    participantId: 'participant-1',
    nicknameSnapshot: '현재닉네임',
    nicknameNormalizedSnapshot: '현재닉네임',
    lifestyle: completeLifestyle,
    intro: '시즌 소개',
    collegeCode: 'ARTS_ENGINEERING',
    grade: '3',
    mbti: 'INTJ',
    birthYear: 2002,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function currentParticipant(overrides: Record<string, unknown> = {}) {
  return {
    ...participant(),
    profile: currentProfile(),
    ...overrides,
  };
}

export function createSeasonParticipantsServiceTestKit() {
  const txUserFindUnique = jest.fn();
  const txSeasonParticipantUpsert = jest.fn();
  const txSeasonParticipantUpdate = jest.fn();
  const txSeasonParticipantFindUnique = jest.fn();
  const txSeasonParticipantProfileUpsert = jest.fn();
  const txSeasonParticipantProfileUpdate = jest.fn();
  const txSeasonParticipantProfileHistoryCreate = jest.fn();
  const txCampusMasterFindUnique = jest.fn();
  const txSeasonFindMany = jest.fn();
  const tx = {
    campusMaster: { findUnique: txCampusMasterFindUnique },
    season: { findMany: txSeasonFindMany },
    user: { findUnique: txUserFindUnique },
    seasonParticipant: {
      upsert: txSeasonParticipantUpsert,
      update: txSeasonParticipantUpdate,
      findUnique: txSeasonParticipantFindUnique,
    },
    seasonParticipantProfile: {
      upsert: txSeasonParticipantProfileUpsert,
      update: txSeasonParticipantProfileUpdate,
    },
    seasonParticipantProfileHistory: { create: txSeasonParticipantProfileHistoryCreate },
    matchRequest: { updateMany: jest.fn() },
    conversationThread: { updateMany: jest.fn() },
  };
  const prisma = {
    getDatabaseNow: jest.fn(),
    runSerializableTransaction: jest.fn(),
    campusMaster: { findMany: jest.fn() },
    user: { findMany: jest.fn(), findUnique: jest.fn() },
    seasonParticipant: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
      findUnique: jest.fn(),
    },
    activeMatch: { findFirst: jest.fn() },
  };
  const seasonsService = { getCurrentSeasonContext: jest.fn() };
  const dormitoriesService = {
    listSelectableDormitoriesForSeasonParticipant: jest.fn(),
    validateSelectableDormitoryForSeasonParticipant: jest.fn(),
  };
  const service = new SeasonParticipantsService(
    prisma as never,
    seasonsService as never,
    dormitoriesService as never,
  );

  prisma.getDatabaseNow.mockResolvedValue(now);
  prisma.runSerializableTransaction.mockImplementation((callback: (txArg: unknown) => unknown) =>
    callback(tx),
  );
  prisma.user.findUnique.mockResolvedValue(user());
  txUserFindUnique.mockResolvedValue(user());
  txCampusMasterFindUnique.mockResolvedValue({ isOperated: true });
  txSeasonFindMany.mockResolvedValue([seasonRuntimeRow()]);
  seasonsService.getCurrentSeasonContext.mockResolvedValue(seasonContext());
  prisma.seasonParticipant.upsert.mockResolvedValue(participant());
  txSeasonParticipantUpsert.mockResolvedValue(participant());
  txSeasonParticipantUpdate.mockResolvedValue(undefined);
  txSeasonParticipantProfileUpsert.mockResolvedValue(undefined);
  txSeasonParticipantProfileUpdate.mockResolvedValue(undefined);
  txSeasonParticipantProfileHistoryCreate.mockResolvedValue({
    id: 'history-1',
    registeredAtSnapshot: now,
  });
  dormitoriesService.listSelectableDormitoriesForSeasonParticipant.mockResolvedValue([
    {
      id: 'dasan',
      name: '다산관',
      campusCode: 'CHUNCHEON',
      roomType: 2,
      genderPolicy: 'M',
      roomSelectionDate: '2026-02-11',
    },
  ]);
  dormitoriesService.validateSelectableDormitoryForSeasonParticipant.mockResolvedValue({
    valid: true,
    item: {
      id: 'dasan',
      name: '다산관',
      campusCode: 'CHUNCHEON',
      roomType: 2,
      genderPolicy: 'M',
      roomSelectionDate: '2026-02-11',
    },
  });
  txSeasonParticipantFindUnique.mockResolvedValue(
    participant({
      participationIntent: 'REGISTERED',
      registeredAt: now,
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      participantStatus: 'ACTIVE',
      activatedAt: now,
      profile: profile(),
    }),
  );
  prisma.seasonParticipant.findUnique.mockResolvedValue(participant({ profile: profile() }));

  return {
    service,
    prisma,
    seasonsService,
    dormitoriesService,
    tx,
    txCampusMasterFindUnique,
    txSeasonFindMany,
    txUserFindUnique,
    txSeasonParticipantUpsert,
    txSeasonParticipantUpdate,
    txSeasonParticipantFindUnique,
    txSeasonParticipantProfileUpsert,
    txSeasonParticipantProfileUpdate,
    txSeasonParticipantProfileHistoryCreate,
  };
}
