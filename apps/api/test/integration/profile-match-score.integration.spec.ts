import { ProfilesService } from '../../src/profiles/profiles.service.js';
import { toCompleteLifestyleColumnData } from '../../src/profiles/profile-lifestyle.persistence.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  authContext,
  DEFAULT_LIFESTYLE,
  seedActiveMatchFixture,
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from './support/integration-fixtures.js';

const COMPLETE_CONDITION_LIFESTYLE = {
  ...DEFAULT_LIFESTYLE,
  smokingTolerance: 'NO_ONLY',
  indoorEatingTolerance: 'NO_SMELL',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'MUST',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
} as const;

describe('ProfilesService match score integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let service: ProfilesService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('profile_score');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    service = app.get(ProfilesService);
  });

  afterAll(async () => {
    if (closeApp) {
      await closeApp();
    }
    if (cleanupDb) {
      await cleanupDb();
    }
  });

  beforeEach(async () => {
    await truncateIntegrationSchema(prisma);
    await seedBaseSeasonFixtures(prisma);
  });

  it('hidden drinking field 차이도 BE match score에 반영되고 public lifestyle에는 노출되지 않는다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'viewer',
      participantId: 'participant-viewer',
      email: 'viewer@kangwon.ac.kr',
      nickname: '뷰어',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'peer-none',
      participantId: 'participant-peer-none',
      email: 'peer-none@kangwon.ac.kr',
      nickname: 'A동기',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'peer-often',
      participantId: 'participant-peer-often',
      email: 'peer-often@kangwon.ac.kr',
      nickname: 'B동기',
    });

    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-viewer' },
      data: {
        ...toCompleteLifestyleColumnData(COMPLETE_CONDITION_LIFESTYLE),
      },
    });

    const sharedVisibleLifestyle = {
      ...COMPLETE_CONDITION_LIFESTYLE,
      bedtime: '24_02',
      wakeTime: '08_09',
    };

    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-peer-none' },
      data: {
        ...toCompleteLifestyleColumnData({
          ...sharedVisibleLifestyle,
          drinkingFrequency: 'NONE',
        }),
      },
    });
    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-peer-often' },
      data: {
        ...toCompleteLifestyleColumnData({
          ...sharedVisibleLifestyle,
          drinkingFrequency: 'OFTEN',
        }),
      },
    });

    const result = await service.getProfiles(authContext('viewer'), { offset: 0, limit: 10 });
    const noneProfile = result.items.find((item) => item.nickname === 'A동기');
    const oftenProfile = result.items.find((item) => item.nickname === 'B동기');

    expect(noneProfile?.exposureLevel).toBe('FULL');
    expect(oftenProfile?.exposureLevel).toBe('FULL');
    expect(noneProfile?.matchScore).toEqual(expect.any(Number));
    expect(oftenProfile?.matchScore).toEqual(expect.any(Number));
    expect(noneProfile?.matchScore).toBeGreaterThan(oftenProfile?.matchScore ?? -1);

    if (noneProfile?.exposureLevel !== 'FULL' || oftenProfile?.exposureLevel !== 'FULL') {
      throw new Error('expected FULL exposure for same-building peers');
    }

    expect(noneProfile.lifestyle).toEqual(oftenProfile.lifestyle);
    expect(noneProfile.lifestyle).not.toHaveProperty('drinkingFrequency');
  });

  it('season participant profile complete invariant는 nullable condition update를 허용하지 않는다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'viewer',
      participantId: 'participant-viewer',
      email: 'viewer@kangwon.ac.kr',
      nickname: '뷰어',
    });

    await expect(
      prisma.seasonParticipantProfile.update({
        where: { participantId: 'participant-viewer' },
        data: {
          smokingTolerance: null as never,
        },
      }),
    ).rejects.toBeTruthy();
  });

  it('같은 사용자 쌍이라도 viewer 기준 점수는 방향에 따라 달라질 수 있다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '사용자A',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '사용자B',
    });

    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-a' },
      data: {
        ...toCompleteLifestyleColumnData({
          ...COMPLETE_CONDITION_LIFESTYLE,
          cleanLevel: 'WEEKLY_3_UP',
          cleanExpectation: 'STRICT',
        }),
      },
    });
    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-b' },
      data: {
        ...toCompleteLifestyleColumnData({
          ...COMPLETE_CONDITION_LIFESTYLE,
          cleanLevel: 'WHEN_DIRTY',
          cleanExpectation: 'FLEXIBLE',
        }),
      },
    });

    const profileForA = await service.getProfileByUserId(authContext('user-a'), 'user-b');
    const profileForB = await service.getProfileByUserId(authContext('user-b'), 'user-a');

    expect(profileForA.exposureLevel).toBe('FULL');
    expect(profileForB.exposureLevel).toBe('FULL');
    expect(profileForA.matchScore).toEqual(expect.any(Number));
    expect(profileForB.matchScore).toEqual(expect.any(Number));
    expect(profileForA.matchScore).not.toBe(profileForB.matchScore);
  });

  it('OFF_SEASON에서는 FULL profile source가 있어도 점수를 노출하지 않는다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'viewer',
      participantId: 'participant-viewer',
      email: 'viewer@kangwon.ac.kr',
      nickname: '뷰어',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'peer',
      participantId: 'participant-peer',
      email: 'peer@kangwon.ac.kr',
      nickname: '상대',
    });

    const now = await prisma.getDatabaseNow();
    await prisma.season.update({
      where: { id: 'season-integration' },
      data: {
        overrideState: 'OFF_SEASON',
        overrideStartedAt: now,
        overrideEndsAt: null,
      },
    });

    const profile = await service.getProfileByUserId(authContext('viewer'), 'peer');

    expect(profile.exposureLevel).toBe('LIMITED');
    expect(profile).not.toHaveProperty('matchScore');
  });

  it('OFF_SEASON에서는 complete profile pair여도 목록 응답에 match score를 포함하지 않는다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'viewer',
      participantId: 'participant-viewer',
      email: 'viewer@kangwon.ac.kr',
      nickname: '뷰어',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'peer',
      participantId: 'participant-peer',
      email: 'peer@kangwon.ac.kr',
      nickname: '상대',
    });

    const now = await prisma.getDatabaseNow();
    await prisma.season.update({
      where: { id: 'season-integration' },
      data: {
        overrideState: 'OFF_SEASON',
        overrideStartedAt: now,
        overrideEndsAt: null,
      },
    });

    const result = await service.getProfiles(authContext('viewer'), { offset: 0, limit: 10 });
    const peer = result.items.find((item) => item.nickname === '상대');

    expect(peer?.exposureLevel).toBe('LIMITED');
    expect(peer).not.toHaveProperty('matchScore');
  });

  it('SEASON_POST_MATCH에서는 최종 matched partner에만 점수를 노출하고 일반 browse에는 숨긴다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'viewer',
      participantId: 'participant-viewer',
      email: 'viewer@kangwon.ac.kr',
      nickname: '뷰어',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'partner',
      participantId: 'participant-partner',
      email: 'partner@kangwon.ac.kr',
      nickname: '최종상대',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'other',
      participantId: 'participant-other',
      email: 'other@kangwon.ac.kr',
      nickname: '일반상대',
    });

    await seedActiveMatchFixture(prisma, {
      activeMatchId: 'active-viewer-partner',
      participantAId: 'participant-viewer',
      participantBId: 'participant-partner',
    });
    await prisma.seasonDormitoryOperation.update({
      where: {
        seasonId_dormitoryId: {
          seasonId: 'season-integration',
          dormitoryId: 'dasan',
        },
      },
      data: {
        roomSelectionDate: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    const partnerProfile = await service.getProfileByUserId(authContext('viewer'), 'partner');
    const otherProfile = await service.getProfileByUserId(authContext('viewer'), 'other');

    expect(partnerProfile.exposureLevel).toBe('FULL');
    expect(partnerProfile.relationToViewer).toBe('MATCHED_PARTNER');
    expect(partnerProfile.matchScore).toEqual(expect.any(Number));

    expect(otherProfile.exposureLevel).toBe('LIMITED');
    expect(otherProfile.relationToViewer).toBe('GENERAL');
    expect(otherProfile).not.toHaveProperty('matchScore');
  });
});
