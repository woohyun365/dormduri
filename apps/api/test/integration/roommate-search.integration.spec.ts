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
      limit: 20,
    });

    expect(result.scope).toBe('CAMPUS_MERGED');
    expect(result.scopeAvailability).toEqual({
      campusMerged: true,
      sameBuildingOnly: false,
    });
    expect(result.resultSummary).toEqual({
      summaryOnlyCount: 2,
      detailViewableCount: 0,
      scoreVisibleCount: 0,
    });
    expect(result.items.map((item) => item.profileSummary.nickname)).toEqual(['유저B', '유저C']);
    expect(result.items.every((item) => item.exposure.canViewFull === false)).toBe(true);
    expect(result.items.every((item) => !('matchScore' in item))).toBe(true);
    expect(result.items.every((item) => typeof item.detailEntryToken === 'string')).toBe(true);
    expect(result.availabilityNotices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SCOPE_RESTRICTED_BY_VIEWER_STATE' }),
        expect.objectContaining({ code: 'DETAIL_UNAVAILABLE_BY_POLICY' }),
      ]),
    );

    await expect(
      service.search(authContext('user-a'), {
        scope: 'SAME_BUILDING_ONLY',
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
      limit: 20,
    });
    const sameBuilding = await service.search(authContext('user-a'), {
      scope: 'SAME_BUILDING_ONLY',
      limit: 20,
    });

    expect(merged.scopeAvailability).toEqual({
      campusMerged: true,
      sameBuildingOnly: true,
    });
    const sameBuildingPeer = merged.items.find((item) => item.profileSummary.nickname === '유저B');
    const otherBuildingPeer = merged.items.find((item) => item.profileSummary.nickname === '유저C');
    expect(sameBuildingPeer?.exposure.canViewFull).toBe(true);
    expect(otherBuildingPeer).toMatchObject({ exposure: { canViewFull: false } });
    expect(otherBuildingPeer).not.toHaveProperty('matchScore');
    expect(sameBuildingPeer).not.toHaveProperty('lifestyle');
    expect(otherBuildingPeer?.detailEntryToken).toEqual(expect.any(String));

    await expect(
      profilesService.getProfileByUserId(authContext('user-a'), 'user-c', {
        detailEntryToken: otherBuildingPeer?.detailEntryToken,
      }),
    ).resolves.toMatchObject({
      detailState: 'TOMBSTONE',
      tombstone: {
        reason: 'DETAIL_NOT_AVAILABLE_DIFFERENT_DORMITORY',
      },
    });

    expect(sameBuilding.scope).toBe('SAME_BUILDING_ONLY');
    expect(sameBuilding.items.map((item) => item.profileSummary.nickname)).toEqual(['유저B']);
    expect(sameBuilding.items[0]?.exposure.canViewFull).toBe(true);
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
      limit: 20,
    });

    expect(result.resultSummary).toEqual({
      summaryOnlyCount: 1,
      detailViewableCount: 1,
      scoreVisibleCount: 1,
    });
    expect(result.items.map((item) => item.profileSummary.nickname)).toEqual(['유저B', '유저C']);
    expect(result.items.find((item) => item.profileSummary.nickname === '유저B')).toMatchObject({
      exposure: { canViewFull: true },
      profileSummary: { smokingBehavior: 'NO' },
    });
    expect(result.items.find((item) => item.profileSummary.nickname === '유저C')).toMatchObject({
      exposure: { canViewFull: false },
      profileSummary: { smokingBehavior: 'NO' },
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
        limit: 20,
      }),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_ROOMMATE_SEARCH_QUERY' },
    });
  });

  it('삭제 처리된 사용자는 search에서 제외하고 기존 summary entry detail 진입은 tombstone으로 degrade한다', async () => {
    await setSeasonState('SEASON_OPEN');
    const beforeDeletion = await service.search(authContext('user-a'), {
      scope: 'SAME_BUILDING_ONLY',
      limit: 20,
    });
    const deletedTargetEntry = beforeDeletion.items.find(
      (item) => item.profileSummary.nickname === '유저B',
    );
    expect(deletedTargetEntry?.detailEntryToken).toEqual(expect.any(String));

    await prisma.user.update({
      where: { id: 'user-b' },
      data: { deletedAt: await prisma.getDatabaseNow() },
    });

    const result = await service.search(authContext('user-a'), {
      scope: 'SAME_BUILDING_ONLY',
      limit: 20,
    });

    expect(result.resultSummary).toEqual({
      summaryOnlyCount: 0,
      detailViewableCount: 1,
      scoreVisibleCount: 1,
    });
    expect(result.items.map((item) => item.profileSummary.nickname)).toEqual(['유저C']);
    expect(result.items.every((item) => item.exposure.canViewFull)).toBe(true);

    await expect(
      profilesService.getProfileByUserId(authContext('user-a'), 'user-b', {
        detailEntryToken: deletedTargetEntry?.detailEntryToken,
      }),
    ).resolves.toMatchObject({
      detailState: 'TOMBSTONE',
      exposure: {
        detailViewable: true,
        canViewFull: false,
      },
      tombstone: {
        reason: 'TARGET_NO_LONGER_DISCOVERABLE',
        displayName: '탈퇴한 사용자',
      },
    });

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
        limit: 20,
      }),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_ROOMMATE_SEARCH_QUERY' },
    });

    const result = await service.search(authContext('user-a'), {
      scope: 'SAME_BUILDING_ONLY',
      limit: 20,
    });

    expect(result.scopeAvailability).toEqual({
      campusMerged: false,
      sameBuildingOnly: true,
    });
    expect(result.resultSummary.summaryOnlyCount).toBe(0);
    expect(result.resultSummary.detailViewableCount).toBe(result.items.length);
    expect(result.items.every((item) => item.exposure.canViewFull)).toBe(true);
  });

  it('SEASON_POST_MATCH roommate-search discovery는 active matched target을 제외하고 notice를 제공한다', async () => {
    await seedSecondDormitory();
    await moveUserToDormitory({ participantId: 'participant-c', dormitoryId: 'saerom' });
    await setSeasonState('SEASON_POST_MATCH');
    await seedActiveMatchFixture(prisma, {
      activeMatchId: 'active-a-b',
      participantAId: 'participant-a',
      participantBId: 'participant-b',
    });

    const result = await service.search(authContext('user-a'), {
      scope: 'CAMPUS_MERGED',
      limit: 20,
    });
    const partner = result.items.find((item) => item.profileSummary.nickname === '유저B');
    const otherDormitoryTarget = result.items.find(
      (item) => item.profileSummary.nickname === '유저C',
    );

    expect(result.scope).toBe('CAMPUS_MERGED');
    expect(result.scopeAvailability).toMatchObject({
      campusMerged: true,
    });
    expect(partner).toBeUndefined();
    expect(result.availabilityNotices).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'MATCHED_TARGETS_EXCLUDED' })]),
    );
    expect(otherDormitoryTarget).toMatchObject({
      relation: { type: 'GENERAL' },
      exposure: { canViewFull: false },
    });
    expect(otherDormitoryTarget).not.toHaveProperty('matchScore');

    await expect(
      profilesService.getProfileByUserId(authContext('user-a'), 'user-c'),
    ).rejects.toMatchObject({
      response: { code: 'PROFILE_NOT_VISIBLE' },
    });
  });

  it('cursor-only pagination은 nickname boundary 이후 다음 page를 반환한다', async () => {
    await setSeasonState('SEASON_OPEN');

    const firstPage = await service.search(authContext('user-a'), {
      scope: 'SAME_BUILDING_ONLY',
      limit: 1,
    });
    expect(firstPage.items.map((item) => item.profileSummary.nickname)).toEqual(['유저B']);
    expect(firstPage.pageInfo.hasNextPage).toBe(true);
    expect(typeof firstPage.pageInfo.nextCursor).toBe('string');

    const secondPage = await service.search(authContext('user-a'), {
      scope: 'SAME_BUILDING_ONLY',
      limit: 1,
      cursor: firstPage.pageInfo.nextCursor ?? undefined,
    });
    expect(secondPage.items.map((item) => item.profileSummary.nickname)).toEqual(['유저C']);
    expect(secondPage.pageInfo).toEqual({
      hasNextPage: false,
      nextCursor: null,
    });

    await expect(
      service.search(authContext('user-a'), {
        scope: 'CAMPUS_MERGED',
        limit: 1,
        cursor: firstPage.pageInfo.nextCursor ?? undefined,
      }),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_ROOMMATE_SEARCH_QUERY' },
    });
  });
});
