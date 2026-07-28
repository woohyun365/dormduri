import { expect, vi } from 'vitest';
import type { SeasonProfileDraftRequest } from '@repo/shared/season/participation';
import { SeasonParticipantsService } from '../application/season-participants.service.js';
import { toLifestyleColumnData } from '../lifestyle/lifestyle-persistence.mapper.js';
import { createSeasonParticipantPublicTargetOwner } from '../public-targets/registration-snapshot.query.js';
import { createSeasonParticipantSourceOwner } from '../participants/season-participant-source.policy.js';
import { createSeasonParticipantWriteOwner } from '../application/season-participant-write-owner.js';

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
    grade: '3',
    mbti: 'INTJ',
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
    academicIdentity: {
      userId: 'user-1',
      collegeCode: 'CHUNCHEON_ARTS_ENGINEERING',
      birthYear: 2002,
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
    collegeCode: 'CHUNCHEON_ARTS_ENGINEERING',
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
    collegeCode: 'CHUNCHEON_ARTS_ENGINEERING',
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

function createSeasonParticipantsServiceTestKitImpl() {
  const txUserFindUnique = vi.fn();
  const txSeasonParticipantUpsert = vi.fn();
  const txSeasonParticipantCreateManyAndReturn = vi.fn();
  const txSeasonParticipantUpdate = vi.fn();
  const txSeasonParticipantFindUnique = vi.fn();
  const txSeasonParticipantProfileUpsert = vi.fn();
  const txSeasonParticipantProfileUpdate = vi.fn();
  const txSeasonParticipantProfileHistoryCreate = vi.fn();
  const txSeasonParticipantLifecycleEventCreate = vi.fn();
  const txSeasonParticipantLifecycleEventCreateMany = vi.fn();
  const txCampusMasterFindUnique = vi.fn();
  const txSeasonFindMany = vi.fn();
  const tx = {
    campusMaster: { findUnique: txCampusMasterFindUnique },
    season: { findMany: txSeasonFindMany },
    user: { findUnique: txUserFindUnique },
    seasonParticipant: {
      upsert: txSeasonParticipantUpsert,
      createManyAndReturn: txSeasonParticipantCreateManyAndReturn,
      update: txSeasonParticipantUpdate,
      findUnique: txSeasonParticipantFindUnique,
    },
    seasonParticipantProfile: {
      upsert: txSeasonParticipantProfileUpsert,
      update: txSeasonParticipantProfileUpdate,
    },
    seasonParticipantProfileHistory: { create: txSeasonParticipantProfileHistoryCreate },
    seasonParticipantLifecycleEvent: {
      create: txSeasonParticipantLifecycleEventCreate,
      createMany: txSeasonParticipantLifecycleEventCreateMany,
    },
    activeMatch: { findFirst: vi.fn() },
    matchRequest: { updateMany: vi.fn() },
  };
  const prisma = {
    getDatabaseNow: vi.fn(),
    runSerializableTransaction: vi.fn(),
    campusMaster: { findMany: vi.fn() },
    user: { findMany: vi.fn(), findUnique: vi.fn() },
    seasonParticipant: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    seasonParticipantProfileHistory: { findFirst: vi.fn() },
    activeMatch: { findFirst: vi.fn() },
  };
  const seasonsService = { getCurrentSeasonContext: vi.fn() };
  const dormitoriesService = {
    listSelectableDormitoriesForSeasonParticipant: vi.fn(),
    validateSelectableDormitoryForSeasonParticipant: vi.fn(),
  };
  const chatThreadWithdrawal = {
    markOpenDirectThreadsReadOnlyForWithdrawnParticipant: vi
      .fn()
      .mockResolvedValue({ updatedThreadIds: [] }),
  };
  const matchParticipantWithdrawal = {
    cancelPendingRequestsForWithdrawnParticipant: vi
      .fn()
      .mockResolvedValue({ canceledPendingMatchRequests: 0 }),
  };
  const writeOwner = createSeasonParticipantWriteOwner({
    prisma: prisma as never,
    seasonsService: seasonsService as never,
    dormitorySelectionCatalog: dormitoriesService,
    chatThreadWithdrawal,
    matchParticipantWithdrawal,
  });
  const service = new SeasonParticipantsService(
    writeOwner,
    createSeasonParticipantPublicTargetOwner(prisma as never),
    createSeasonParticipantSourceOwner(),
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
  txSeasonParticipantCreateManyAndReturn.mockResolvedValue([]);
  txSeasonParticipantUpdate.mockResolvedValue(undefined);
  txSeasonParticipantProfileUpsert.mockResolvedValue(undefined);
  txSeasonParticipantProfileUpdate.mockResolvedValue(undefined);
  txSeasonParticipantProfileHistoryCreate.mockResolvedValue({
    id: 'history-1',
    registeredAtSnapshot: now,
  });
  txSeasonParticipantLifecycleEventCreate.mockResolvedValue({ id: 'lifecycle-event-1' });
  txSeasonParticipantLifecycleEventCreateMany.mockResolvedValue({ count: 0 });
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
    chatThreadWithdrawal,
    matchParticipantWithdrawal,
    tx,
    txCampusMasterFindUnique,
    txSeasonFindMany,
    txUserFindUnique,
    txSeasonParticipantUpsert,
    txSeasonParticipantCreateManyAndReturn,
    txSeasonParticipantUpdate,
    txSeasonParticipantFindUnique,
    txSeasonParticipantProfileUpsert,
    txSeasonParticipantProfileUpdate,
    txSeasonParticipantProfileHistoryCreate,
    txSeasonParticipantLifecycleEventCreate,
    txSeasonParticipantLifecycleEventCreateMany,
  };
}

export type SeasonParticipantsServiceTestKit = ReturnType<
  typeof createSeasonParticipantsServiceTestKitImpl
>;

export function createSeasonParticipantsServiceTestKit(): SeasonParticipantsServiceTestKit {
  return createSeasonParticipantsServiceTestKitImpl();
}
