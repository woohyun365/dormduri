import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import type { LifestyleData } from '../../src/auth/lifestyle.schema.js';
import { ProfilesService } from '../../src/profiles/profiles.service.js';
import { RoommateSearchService } from '../../src/profiles/roommate-search.service.js';
import { toCompleteLifestyleColumnData } from '../../src/common/lifestyle/lifestyle.persistence.js';
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
  let profilesService: ProfilesService;
  let roommateSearchService: RoommateSearchService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('profile_score');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    profilesService = app.get(ProfilesService);
    roommateSearchService = app.get(RoommateSearchService);
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

  it('hidden drinking field 차이도 BE match score에 반영되지만 summary/detail public surface에는 노출되지 않는다', async () => {
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

    const sharedVisibleLifestyle: LifestyleData = {
      ...COMPLETE_CONDITION_LIFESTYLE,
      bedtime: '24_02',
      wakeTime: '08_09',
    };
    const noneVisibleLifestyle: LifestyleData = {
      ...sharedVisibleLifestyle,
      drinkingFrequency: 'NONE',
    };
    const oftenVisibleLifestyle: LifestyleData = {
      ...sharedVisibleLifestyle,
      drinkingFrequency: 'OFTEN',
    };

    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-peer-none' },
      data: {
        ...toCompleteLifestyleColumnData(noneVisibleLifestyle),
      },
    });
    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-peer-often' },
      data: {
        ...toCompleteLifestyleColumnData(oftenVisibleLifestyle),
      },
    });

    const result = await roommateSearchService.search(authContext('viewer'), {
      scope: 'SAME_BUILDING_ONLY',
      limit: 10,
    });
    const noneProfile = result.items.find((item) => item.profileSummary.nickname === 'A동기');
    const oftenProfile = result.items.find((item) => item.profileSummary.nickname === 'B동기');

    expect(result.appliedSort).toBe('NICKNAME');
    expect(noneProfile?.exposure.canViewFull).toBe(true);
    expect(oftenProfile?.exposure.canViewFull).toBe(true);
    if (
      !noneProfile?.exposure.canViewFull ||
      typeof noneProfile.matchScore !== 'number' ||
      !oftenProfile?.exposure.canViewFull ||
      typeof oftenProfile.matchScore !== 'number'
    ) {
      throw new Error('expected same-building peers to allow full detail');
    }
    expect(noneProfile.matchScore).toBeGreaterThan(oftenProfile.matchScore);
    expect(noneProfile).not.toHaveProperty('lifestyle');
    expect(oftenProfile).not.toHaveProperty('lifestyle');

    const noneDetail = await profilesService.getProfileByUserId(
      authContext('viewer'),
      'peer-none',
      {
        detailEntryToken: noneProfile.detailEntryToken,
      },
    );
    const oftenDetail = await profilesService.getProfileByUserId(
      authContext('viewer'),
      'peer-often',
      { detailEntryToken: oftenProfile.detailEntryToken },
    );

    if (
      noneDetail.detailState !== 'FULL' ||
      oftenDetail.detailState !== 'FULL' ||
      !noneDetail.exposure.canViewFull ||
      !oftenDetail.exposure.canViewFull
    ) {
      throw new Error('expected detail-viewable same-building peers');
    }

    expect(noneDetail.lifestyle).not.toHaveProperty('drinkingFrequency');
    expect(noneDetail.lifestyle).not.toHaveProperty('drinkingTolerance');
    expect(oftenDetail.lifestyle).not.toHaveProperty('drinkingFrequency');
    expect(oftenDetail.lifestyle).not.toHaveProperty('drinkingTolerance');
  });

  it('incomplete season participant profile은 public score/detail target에서 제외된다', async () => {
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

    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-peer' },
      data: {
        smokingTolerance: null,
      },
    });

    const result = await roommateSearchService.search(authContext('viewer'), {
      scope: 'SAME_BUILDING_ONLY',
      limit: 10,
    });

    expect(result.items.map((item) => item.profileSummary.nickname)).not.toContain('상대');
    await expect(
      profilesService.getProfileByUserId(authContext('viewer'), 'peer'),
    ).rejects.toMatchObject({
      response: {
        code: 'PROFILE_NOT_VISIBLE',
      },
    });
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

    const searchForA = await roommateSearchService.search(authContext('user-a'), {
      scope: 'SAME_BUILDING_ONLY',
      limit: 10,
    });
    const searchForB = await roommateSearchService.search(authContext('user-b'), {
      scope: 'SAME_BUILDING_ONLY',
      limit: 10,
    });
    const tokenForB = searchForA.items.find(
      (item) => item.profileSummary.nickname === '사용자B',
    )?.detailEntryToken;
    const tokenForA = searchForB.items.find(
      (item) => item.profileSummary.nickname === '사용자A',
    )?.detailEntryToken;
    const profileForA = await profilesService.getProfileByUserId(authContext('user-a'), 'user-b', {
      detailEntryToken: tokenForB,
    });
    const profileForB = await profilesService.getProfileByUserId(authContext('user-b'), 'user-a', {
      detailEntryToken: tokenForA,
    });

    if (
      profileForA.detailState !== 'FULL' ||
      profileForB.detailState !== 'FULL' ||
      !profileForA.exposure.canViewFull ||
      !profileForB.exposure.canViewFull
    ) {
      throw new Error('expected full profile details with match scores');
    }

    expect(profileForA.exposure.canViewFull).toBe(true);
    expect(profileForB.exposure.canViewFull).toBe(true);
    expect(profileForA.matchScore).toEqual(expect.any(Number));
    expect(profileForB.matchScore).toEqual(expect.any(Number));
    expect(profileForA.matchScore).not.toBe(profileForB.matchScore);
  });

  it('OFF_SEASON에서는 full detail을 열지 않고 merged summary에도 점수를 노출하지 않는다', async () => {
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

    await expect(
      profilesService.getProfileByUserId(authContext('viewer'), 'peer'),
    ).rejects.toMatchObject({
      response: {
        code: 'PROFILE_NOT_VISIBLE',
      },
    });

    await expect(
      roommateSearchService.search(authContext('viewer'), {
        limit: 10,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'INVALID_ROOMMATE_SEARCH_QUERY',
      },
    });
  });

  it('SEASON_POST_MATCH에서는 최종 matched partner만 detail과 score를 유지하고 다른 등록자는 summary-only로 본다', async () => {
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

    const searchResult = await roommateSearchService.search(authContext('viewer'), {
      scope: 'SAME_BUILDING_ONLY',
      limit: 10,
    });
    const partnerSummary = searchResult.items.find(
      (item) => item.profileSummary.nickname === '최종상대',
    );
    const otherSummary = searchResult.items.find(
      (item) => item.profileSummary.nickname === '일반상대',
    );

    expect(partnerSummary).toBeUndefined();
    expect(searchResult.availabilityNotices).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MATCHED_TARGETS_EXCLUDED' })]),
    );
    expect(otherSummary).toMatchObject({
      relation: { type: 'GENERAL' },
      exposure: { canViewFull: false },
    });
    expect(otherSummary).not.toHaveProperty('matchScore');

    const partnerProfile = await profilesService.getProfileByUserId(
      authContext('viewer'),
      'partner',
    );
    expect(partnerProfile.exposure.canViewFull).toBe(true);
    expect(partnerProfile.relation.type).toBe('MATCHED_PARTNER');

    await expect(
      profilesService.getProfileByUserId(authContext('viewer'), 'other'),
    ).rejects.toMatchObject({
      response: {
        code: 'PROFILE_NOT_VISIBLE',
      },
    });
  });
});
