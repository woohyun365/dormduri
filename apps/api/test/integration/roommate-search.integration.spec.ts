import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { ProfilesService } from '../../src/profiles/profiles.service.js';
import { RoommateSearchService } from '../../src/profiles/roommate-search.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  authContext,
  seedActiveMatchFixture,
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from './support/integration-fixtures.js';

describe('RoommateSearchService integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let profilesService: ProfilesService;
  let service: RoommateSearchService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('roommate_search_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    profilesService = app.get(ProfilesService);
    service = app.get(RoommateSearchService);
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
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-b',
      participantId: 'participant-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-c',
      participantId: 'participant-c',
      email: 'user-c@kangwon.ac.kr',
      nickname: '유저C',
    });
  });

  async function seedSecondDormitory() {
    await prisma.dormitory.create({
      data: {
        id: 'saerom',
        campusCode: 'CHUNCHEON',
        nameKo: '새롬관',
        roomType: 2,
        genderPolicy: 'M',
        sortOrder: 2,
      },
    });
    await prisma.seasonDormitoryOperation.create({
      data: {
        seasonId: 'season-integration',
        dormitoryId: 'saerom',
        isOperated: true,
        roomSelectionDate: new Date('2026-12-31T00:00:00.000Z'),
      },
    });
  }

  async function moveUserToDormitory(input: { participantId: string; dormitoryId: string }) {
    await prisma.seasonParticipant.update({
      where: { id: input.participantId },
      data: {
        dormitoryId: input.dormitoryId,
        dormitorySelectionState: 'ASSIGNED',
      },
    });
  }

  async function setSeasonState(
    state: 'OFF_SEASON' | 'SEASON_OPEN' | 'SEASON_MATCHING' | 'SEASON_POST_MATCH',
  ) {
    const now = await prisma.getDatabaseNow();
    await prisma.season.update({
      where: { id: 'season-integration' },
      data: {
        overrideState: state,
        overrideStartedAt: now,
        overrideEndsAt: null,
      },
    });
  }

  async function makeViewerNonParticipant() {
    await prisma.seasonParticipantProfile.delete({
      where: { participantId: 'participant-a' },
    });
    await prisma.seasonParticipant.update({
      where: { id: 'participant-a' },
      data: {
        participationIntent: 'UNDECIDED',
        registeredAt: null,
        participantStatus: 'NOT_STARTED',
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
      },
    });
  }

  it('OFF_SEASON에서는 roommate browse와 detail을 모두 막는다', async () => {
    await setSeasonState('OFF_SEASON');

    await expect(
      service.search(authContext('user-a'), {
        offset: 0,
        limit: 20,
      }),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_ROOMMATE_SEARCH_QUERY' },
    });

    await expect(
      profilesService.getProfileByUserId(authContext('user-a'), 'user-b'),
    ).rejects.toMatchObject({
      response: { code: 'PROFILE_NOT_VISIBLE' },
    });
  });

  it('시즌 중 미참여 viewer는 registered season profile cohort의 merged summary만 본다', async () => {
    await setSeasonState('SEASON_MATCHING');
    await makeViewerNonParticipant();

    const result = await service.search(authContext('user-a'), {
      offset: 0,
      limit: 20,
    });

    expect(result.scope).toBe('CAMPUS_MERGED');
    expect(result.scopeCapabilities).toEqual({
      campusMerged: true,
      sameBuildingOnly: false,
    });
    expect(result.resultSummary).toEqual({
      summaryOnlyCount: 2,
      detailViewableCount: 0,
      scoreVisibleCount: 0,
    });
    expect(result.items.map((item) => item.nickname)).toEqual(['유저B', '유저C']);
    expect(result.items.every((item) => item.canViewFull === false)).toBe(true);
    expect(result.items.every((item) => !('matchScore' in item))).toBe(true);

    await expect(
      service.search(authContext('user-a'), {
        scope: 'SAME_BUILDING_ONLY',
        offset: 0,
        limit: 20,
      }),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_ROOMMATE_SEARCH_QUERY' },
    });
  });

  it('SEASON_OPEN 등록+배정 사용자는 merged와 same-building scope를 모두 사용할 수 있다', async () => {
    await seedSecondDormitory();
    await moveUserToDormitory({
      participantId: 'participant-c',
      dormitoryId: 'saerom',
    });
    await setSeasonState('SEASON_OPEN');

    const merged = await service.search(authContext('user-a'), {
      scope: 'CAMPUS_MERGED',
      offset: 0,
      limit: 20,
    });
    const sameBuilding = await service.search(authContext('user-a'), {
      scope: 'SAME_BUILDING_ONLY',
      offset: 0,
      limit: 20,
    });

    expect(merged.scopeCapabilities).toEqual({
      campusMerged: true,
      sameBuildingOnly: true,
    });
    const sameBuildingPeer = merged.items.find((item) => item.nickname === '유저B');
    const otherBuildingPeer = merged.items.find((item) => item.nickname === '유저C');
    expect(sameBuildingPeer?.canViewFull).toBe(true);
    expect(otherBuildingPeer).toMatchObject({ canViewFull: false });
    expect(otherBuildingPeer).not.toHaveProperty('matchScore');
    expect(sameBuildingPeer).not.toHaveProperty('lifestyle');

    expect(sameBuilding.scope).toBe('SAME_BUILDING_ONLY');
    expect(sameBuilding.items.map((item) => item.nickname)).toEqual(['유저B']);
    expect(sameBuilding.items[0]?.canViewFull).toBe(true);
  });

  it('SEASON_OPEN merged에서 summary filter는 summary-only 후보까지 같은 field set으로 필터링한다', async () => {
    await seedSecondDormitory();
    await moveUserToDormitory({
      participantId: 'participant-c',
      dormitoryId: 'saerom',
    });
    await setSeasonState('SEASON_OPEN');

    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-b' },
      data: { smokingBehavior: 'NO' },
    });
    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-c' },
      data: { smokingBehavior: 'NO' },
    });

    const result = await service.search(authContext('user-a'), {
      scope: 'CAMPUS_MERGED',
      smokingBehavior: 'NO',
      offset: 0,
      limit: 20,
    });

    expect(result.resultSummary).toEqual({
      summaryOnlyCount: 1,
      detailViewableCount: 1,
      scoreVisibleCount: 1,
    });
    expect(result.items.map((item) => item.nickname)).toEqual(['유저B', '유저C']);
    expect(result.items.find((item) => item.nickname === '유저B')).toMatchObject({
      canViewFull: true,
      smokingBehavior: 'NO',
    });
    expect(result.items.find((item) => item.nickname === '유저C')).toMatchObject({
      canViewFull: false,
      smokingBehavior: 'NO',
    });
  });

  it('SEASON_OPEN mixed query에서 optional additional/detail-only filter는 400이다', async () => {
    await seedSecondDormitory();
    await moveUserToDormitory({
      participantId: 'participant-c',
      dormitoryId: 'saerom',
    });
    await setSeasonState('SEASON_OPEN');

    await expect(
      service.search(authContext('user-a'), {
        scope: 'CAMPUS_MERGED',
        college: 'ARTS_ENGINEERING',
        offset: 0,
        limit: 20,
      }),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_ROOMMATE_SEARCH_QUERY' },
    });
  });

  it('삭제 처리된 사용자는 시즌 roommate-search summary와 detail-capable target에서 제외된다', async () => {
    await setSeasonState('SEASON_OPEN');
    await prisma.user.update({
      where: { id: 'user-b' },
      data: { deletedAt: await prisma.getDatabaseNow() },
    });

    const result = await service.search(authContext('user-a'), {
      scope: 'SAME_BUILDING_ONLY',
      offset: 0,
      limit: 20,
    });

    expect(result.resultSummary).toEqual({
      summaryOnlyCount: 0,
      detailViewableCount: 1,
      scoreVisibleCount: 1,
    });
    expect(result.items.map((item) => item.nickname)).toEqual(['유저C']);
    expect(result.items.every((item) => item.canViewFull)).toBe(true);

    await expect(
      profilesService.getProfileByUserId(authContext('user-a'), 'user-b'),
    ).rejects.toMatchObject({
      response: { code: 'PROFILE_NOT_VISIBLE' },
    });
  });

  it('SEASON_MATCHING 등록 viewer는 same-building만 보고 explicit CAMPUS_MERGED는 400이다', async () => {
    await setSeasonState('SEASON_MATCHING');

    await expect(
      service.search(authContext('user-a'), {
        scope: 'CAMPUS_MERGED',
        offset: 0,
        limit: 20,
      }),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_ROOMMATE_SEARCH_QUERY' },
    });

    const result = await service.search(authContext('user-a'), {
      scope: 'SAME_BUILDING_ONLY',
      offset: 0,
      limit: 20,
    });

    expect(result.scopeCapabilities).toEqual({
      campusMerged: false,
      sameBuildingOnly: true,
    });
    expect(result.resultSummary.summaryOnlyCount).toBe(0);
    expect(result.resultSummary.detailViewableCount).toBe(result.items.length);
    expect(result.items.every((item) => item.canViewFull)).toBe(true);
  });

  it('SEASON_POST_MATCH matched viewer는 same-building 목록에서 partner만 detail-capable이고 나머지는 summary-only다', async () => {
    await seedActiveMatchFixture(prisma, {
      activeMatchId: 'active-a-b',
      participantAId: 'participant-a',
      participantBId: 'participant-b',
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

    const result = await service.search(authContext('user-a'), {
      scope: 'SAME_BUILDING_ONLY',
      offset: 0,
      limit: 20,
    });
    const partner = result.items.find((item) => item.nickname === '유저B');
    const other = result.items.find((item) => item.nickname === '유저C');

    expect(result.scopeCapabilities).toEqual({
      campusMerged: false,
      sameBuildingOnly: true,
    });
    expect(partner?.relationToViewer).toBe('MATCHED_PARTNER');
    expect(partner?.canViewFull).toBe(true);
    expect(other).toMatchObject({
      relationToViewer: 'GENERAL',
      canViewFull: false,
    });
    expect(other).not.toHaveProperty('matchScore');

    await expect(
      profilesService.getProfileByUserId(authContext('user-a'), 'user-c'),
    ).rejects.toMatchObject({
      response: { code: 'PROFILE_NOT_VISIBLE' },
    });
  });
});
