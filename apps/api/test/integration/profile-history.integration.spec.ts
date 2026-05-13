import { AuthService } from '../../src/auth/auth.service.js';
import type { AuthenticatedUserContext } from '../../src/auth/auth-session.service.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { ProfilesService } from '../../src/profiles/profiles.service.js';
import { toLifestyleColumnData } from '../../src/profiles/profile-lifestyle.persistence.js';
import { SeasonParticipantsService } from '../../src/season-participants/season-participants.service.js';
import { UsersService } from '../../src/users/users.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  DEFAULT_LIFESTYLE,
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from './support/integration-fixtures.js';

describe('Profile history integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let authService: AuthService;
  let profilesService: ProfilesService;
  let usersService: UsersService;
  let seasonParticipantsService: SeasonParticipantsService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('profile_history_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    authService = app.get(AuthService);
    profilesService = app.get(ProfilesService);
    usersService = app.get(UsersService);
    seasonParticipantsService = app.get(SeasonParticipantsService);
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

  it('signup은 UserProfileHistory를 1행 남긴다', async () => {
    const email = 'profile-history-signup@kangwon.ac.kr';
    await seedVerifiedSignupCode(email);

    const signupResult = await authService.signup({
      email,
      password: 'Pass1234',
      nickname: '히스토리회원',
      gender: 'M',
      campus: 'CHUNCHEON',
      lifestyle: DEFAULT_LIFESTYLE,
      intro: 'signup intro',
    });

    expect(signupResult.accessToken).toBeDefined();

    const createdUser = await prisma.user.findUniqueOrThrow({
      where: { emailNormalized: email.toLowerCase() },
      select: { id: true },
    });

    const historyRows = await prisma.userProfileHistory.findMany({
      where: { userId: createdUser.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(historyRows).toHaveLength(1);
    expect(historyRows[0]).toMatchObject({
      source: 'SIGNUP_CREATE',
      nickname: '히스토리회원',
      intro: 'signup intro',
      bedtime: 'BETWEEN_22_24',
      wakeTime: 'BETWEEN_07_08',
    });
  });

  it('off-season base profile edit는 UserProfileHistory만 append한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await setSeasonOverride('OFF_SEASON');

    await profilesService.updateNickname(await loadAuthContext('user-a'), '유저A변경');

    const userHistory = await prisma.userProfileHistory.findMany({
      where: { userId: 'user-a' },
      orderBy: { createdAt: 'asc' },
    });
    const seasonHistoryCount = await prisma.seasonParticipantProfileHistory.count({
      where: { participantId: 'participant-a' },
    });

    expect(userHistory).toHaveLength(1);
    expect(userHistory[0]).toMatchObject({
      source: 'USER_EDIT',
      nickname: '유저A변경',
    });
    expect(seasonHistoryCount).toBe(0);
  });

  it('off-season condition edit는 UserProfileHistory만 append한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await setSeasonOverride('OFF_SEASON');

    await profilesService.updateLifestyle(await loadAuthContext('user-a'), {
      ...DEFAULT_LIFESTYLE,
      smokingTolerance: 'ANY',
    });

    const userHistory = await prisma.userProfileHistory.findMany({
      where: { userId: 'user-a' },
      orderBy: { createdAt: 'asc' },
    });
    const seasonHistoryCount = await prisma.seasonParticipantProfileHistory.count({
      where: { participantId: 'participant-a' },
    });

    expect(userHistory).toHaveLength(1);
    expect(userHistory[0]).toMatchObject({
      source: 'USER_EDIT',
      smokingTolerance: 'ANY',
    });
    expect(seasonHistoryCount).toBe(0);
  });

  it('off-season intro edit는 UserProfileHistory만 append한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await setSeasonOverride('OFF_SEASON');

    await usersService.updateCurrentUser(await loadAuthContext('user-a'), {
      intro: '오프시즌 소개 수정',
    });

    const userHistory = await prisma.userProfileHistory.findMany({
      where: { userId: 'user-a' },
      orderBy: { createdAt: 'asc' },
    });
    const seasonHistoryCount = await prisma.seasonParticipantProfileHistory.count({
      where: { participantId: 'participant-a' },
    });

    expect(userHistory).toHaveLength(1);
    expect(userHistory[0]).toMatchObject({
      source: 'USER_EDIT',
      intro: '오프시즌 소개 수정',
    });
    expect(seasonHistoryCount).toBe(0);
  });

  it('off-season에서 동일한 intro를 다시 저장하면 history를 남기지 않는다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await setSeasonOverride('OFF_SEASON');

    await usersService.updateCurrentUser(await loadAuthContext('user-a'), {
      intro: '유저A 소개',
    });

    expect(
      await prisma.userProfileHistory.count({
        where: { userId: 'user-a' },
      }),
    ).toBe(0);
  });

  it('season registration은 SeasonParticipantProfileHistory를 1행 남긴다', async () => {
    await seedVerifiedStandaloneUser({
      userId: 'user-b',
      email: 'user-b@kangwon.ac.kr',
      nickname: '유저B',
    });
    await setSeasonOverride('SEASON_OPEN');

    const participant =
      await seasonParticipantsService.registerCurrentSeasonParticipation('user-b');

    const userHistoryCount = await prisma.userProfileHistory.count({
      where: { userId: 'user-b' },
    });
    const seasonHistory = await prisma.seasonParticipantProfileHistory.findMany({
      where: { participantId: participant.id },
      orderBy: { createdAt: 'asc' },
    });

    expect(userHistoryCount).toBe(0);
    expect(seasonHistory).toHaveLength(1);
    expect(seasonHistory[0]).toMatchObject({
      source: 'SEASON_REGISTRATION',
      seasonId: 'season-integration',
      nicknameSnapshot: '유저B',
      bedtime: 'BETWEEN_22_24',
      wakeTime: 'BETWEEN_07_08',
    });
  });

  it('season source에서 룸메 조건을 수정하면 base + season history를 함께 append한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await setSeasonOverride('SEASON_OPEN');

    await profilesService.updateLifestyle(await loadAuthContext('user-a'), {
      ...DEFAULT_LIFESTYLE,
      smokingTolerance: 'ANY',
    });

    const userHistory = await prisma.userProfileHistory.findMany({
      where: { userId: 'user-a' },
      orderBy: { createdAt: 'asc' },
    });
    const seasonHistory = await prisma.seasonParticipantProfileHistory.findMany({
      where: { participantId: 'participant-a' },
      orderBy: { createdAt: 'asc' },
    });

    expect(userHistory).toHaveLength(1);
    expect(userHistory[0]).toMatchObject({
      source: 'USER_EDIT',
      smokingTolerance: 'ANY',
    });
    expect(seasonHistory).toHaveLength(1);
    expect(seasonHistory[0]).toMatchObject({
      source: 'SEASON_USER_EDIT',
      smokingTolerance: 'ANY',
    });
  });

  it('season intro edit는 base + season history를 함께 append한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await setSeasonOverride('SEASON_OPEN');

    await usersService.updateCurrentUser(await loadAuthContext('user-a'), {
      intro: '시즌 소개 수정',
    });

    const userHistory = await prisma.userProfileHistory.findMany({
      where: { userId: 'user-a' },
      orderBy: { createdAt: 'asc' },
    });
    const seasonHistory = await prisma.seasonParticipantProfileHistory.findMany({
      where: { participantId: 'participant-a' },
      orderBy: { createdAt: 'asc' },
    });

    expect(userHistory).toHaveLength(1);
    expect(userHistory[0]).toMatchObject({
      source: 'USER_EDIT',
      intro: '시즌 소개 수정',
    });
    expect(seasonHistory).toHaveLength(1);
    expect(seasonHistory[0]).toMatchObject({
      source: 'SEASON_USER_EDIT',
      intro: '시즌 소개 수정',
    });
  });

  it('season additional profile edit는 base + season history를 함께 append한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await setSeasonOverride('SEASON_OPEN');

    await usersService.updateCurrentUser(await loadAuthContext('user-a'), {
      additional: {
        mbti: 'intj',
        birthYear: 2002,
      },
    });

    const userHistory = await prisma.userProfileHistory.findMany({
      where: { userId: 'user-a' },
      orderBy: { createdAt: 'asc' },
    });
    const seasonHistory = await prisma.seasonParticipantProfileHistory.findMany({
      where: { participantId: 'participant-a' },
      orderBy: { createdAt: 'asc' },
    });

    expect(userHistory).toHaveLength(1);
    expect(userHistory[0]).toMatchObject({
      source: 'USER_EDIT',
      mbti: 'INTJ',
      birthYear: 2002,
    });
    expect(seasonHistory).toHaveLength(1);
    expect(seasonHistory[0]).toMatchObject({
      source: 'SEASON_USER_EDIT',
      mbti: 'INTJ',
      birthYear: 2002,
    });
  });

  it('season profile에서 messageToRoommate를 수정하면 base + season history를 함께 append한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await setSeasonOverride('SEASON_OPEN');

    await usersService.updateCurrentUser(await loadAuthContext('user-a'), {
      messageToRoommate: '새 시즌 메시지',
    });

    const userHistory = await prisma.userProfileHistory.findMany({
      where: { userId: 'user-a' },
      orderBy: { createdAt: 'asc' },
    });
    const seasonHistory = await prisma.seasonParticipantProfileHistory.findMany({
      where: { participantId: 'participant-a' },
      orderBy: { createdAt: 'asc' },
    });

    expect(userHistory).toHaveLength(1);
    expect(userHistory[0]).toMatchObject({
      source: 'USER_EDIT',
      messageToRoommate: '새 시즌 메시지',
    });
    expect(seasonHistory).toHaveLength(1);
    expect(seasonHistory[0]).toMatchObject({
      source: 'SEASON_USER_EDIT',
      messageToRoommate: '새 시즌 메시지',
    });
  });

  it('season source에서 lifestyle/condition payload가 현재 값과 같으면 base/season history를 추가하지 않는다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await setSeasonOverride('SEASON_OPEN');

    await profilesService.updateLifestyle(await loadAuthContext('user-a'), {
      ...DEFAULT_LIFESTYLE,
    });

    expect(
      await prisma.userProfileHistory.count({
        where: { userId: 'user-a' },
      }),
    ).toBe(0);
    expect(
      await prisma.seasonParticipantProfileHistory.count({
        where: { participantId: 'participant-a' },
      }),
    ).toBe(0);
  });

  it('season source에서 base + season에 함께 저장되는 텍스트/추가 프로필 값이 전혀 바뀌지 않으면 history를 추가하지 않는다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await setSeasonOverride('SEASON_OPEN');

    await prisma.userProfile.update({
      where: { userId: 'user-a' },
      data: {
        intro: '동일 소개',
        messageToRoommate: '동일 메시지',
        grade: '4+',
        mbti: 'ENTP',
        birthYear: 2001,
      },
    });
    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-a' },
      data: {
        intro: '동일 소개',
        messageToRoommate: '동일 메시지',
        grade: '4+',
        mbti: 'ENTP',
        birthYear: 2001,
      },
    });

    await usersService.updateCurrentUser(await loadAuthContext('user-a'), {
      intro: '동일 소개',
      messageToRoommate: '동일 메시지',
      additional: {
        grade: '4+',
        mbti: 'entp',
        birthYear: 2001,
      },
    });

    const baseProfile = await prisma.userProfile.findUniqueOrThrow({
      where: { userId: 'user-a' },
      select: {
        intro: true,
        messageToRoommate: true,
        collegeCode: true,
        grade: true,
        mbti: true,
        birthYear: true,
      },
    });
    expect(baseProfile).toMatchObject({
      intro: '동일 소개',
      messageToRoommate: '동일 메시지',
      collegeCode: null,
      grade: '4+',
      mbti: 'ENTP',
      birthYear: 2001,
    });
    expect(
      await prisma.userProfileHistory.count({
        where: { userId: 'user-a' },
      }),
    ).toBe(0);
    expect(
      await prisma.seasonParticipantProfileHistory.count({
        where: { participantId: 'participant-a' },
      }),
    ).toBe(0);
  });

  it('season source에서 sync된 동적 공개 문구/추가 프로필은 OFF_SEASON 전환 후 base canonical 값으로 이어진다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await setSeasonOverride('SEASON_OPEN');
    const authUser = await loadAuthContext('user-a');

    await usersService.updateCurrentUser(authUser, {
      messageToRoommate: '오프시즌까지 유지될 메시지',
      additional: {
        grade: '4+',
        mbti: 'ENTP',
        birthYear: 2001,
      },
    });
    await setSeasonOverride('OFF_SEASON');

    const currentUser = await usersService.getCurrentUser(authUser);

    expect(currentUser.profile.source).toBe('USER_PROFILE');
    expect(currentUser.profile.messageToRoommate).toBe('오프시즌까지 유지될 메시지');
    expect(currentUser.profile.additional).toMatchObject({
      grade: '4+',
      mbti: 'ENTP',
      birthYear: 2001,
    });
  });

  it('서로 다른 season edit 경로를 연속 호출하면 history는 dedupe 없이 누적된다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await setSeasonOverride('SEASON_OPEN');
    const authUser = await loadAuthContext('user-a');

    await profilesService.updateLifestyle(authUser, {
      ...DEFAULT_LIFESTYLE,
      smokingTolerance: 'ANY',
    });
    await usersService.updateCurrentUser(authUser, {
      messageToRoommate: '두 번째 시즌 메시지',
    });

    const userHistory = await prisma.userProfileHistory.findMany({
      where: { userId: 'user-a' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const seasonHistory = await prisma.seasonParticipantProfileHistory.findMany({
      where: { participantId: 'participant-a' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const latestUserHistory = await prisma.userProfileHistory.findFirst({
      where: { userId: 'user-a' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const latestSeasonHistory = await prisma.seasonParticipantProfileHistory.findFirst({
      where: { participantId: 'participant-a' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    expect(userHistory).toHaveLength(2);
    expect(seasonHistory).toHaveLength(2);
    expect(userHistory[0]).toMatchObject({
      source: 'USER_EDIT',
      smokingTolerance: 'ANY',
    });
    expect(userHistory[1]).toMatchObject({
      source: 'USER_EDIT',
      messageToRoommate: '두 번째 시즌 메시지',
    });
    expect(seasonHistory[0]).toMatchObject({
      source: 'SEASON_USER_EDIT',
      smokingTolerance: 'ANY',
    });
    expect(seasonHistory[1]).toMatchObject({
      source: 'SEASON_USER_EDIT',
      messageToRoommate: '두 번째 시즌 메시지',
    });
    expect(latestUserHistory).toMatchObject({
      messageToRoommate: '두 번째 시즌 메시지',
      smokingTolerance: 'ANY',
    });
    expect(latestSeasonHistory).toMatchObject({
      messageToRoommate: '두 번째 시즌 메시지',
      smokingTolerance: 'ANY',
    });
  });

  it('current season template sync repair는 기존 season/base sync 대상 필드 mismatch를 base에 반영한다', async () => {
    await seedRegisteredAssignedParticipant(prisma, {
      userId: 'user-a',
      participantId: 'participant-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    await setSeasonOverride('SEASON_MATCHING');
    await prisma.seasonParticipantProfile.update({
      where: { participantId: 'participant-a' },
      data: {
        messageToRoommate: '보정 대상 시즌 메시지',
        grade: '4+',
        mbti: 'ENTP',
        birthYear: 2001,
      },
    });

    const syncedCount = await seasonParticipantsService.syncCurrentSeasonProfileTemplates(
      await prisma.getDatabaseNow(),
    );

    const baseProfile = await prisma.userProfile.findUniqueOrThrow({
      where: { userId: 'user-a' },
      select: {
        intro: true,
        messageToRoommate: true,
        collegeCode: true,
        grade: true,
        mbti: true,
        birthYear: true,
      },
    });
    const latestUserHistory = await prisma.userProfileHistory.findFirst({
      where: { userId: 'user-a' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

    expect(syncedCount).toBe(1);
    expect(baseProfile.intro).toBe('유저A 소개');
    expect(baseProfile.messageToRoommate).toBe('보정 대상 시즌 메시지');
    expect(baseProfile.collegeCode).toBeNull();
    expect(baseProfile.grade).toBe('4+');
    expect(baseProfile.mbti).toBe('ENTP');
    expect(baseProfile.birthYear).toBe(2001);
    expect(latestUserHistory).toMatchObject({
      source: 'SYSTEM_BACKFILL',
      messageToRoommate: '보정 대상 시즌 메시지',
      collegeCode: null,
      grade: '4+',
      mbti: 'ENTP',
      birthYear: 2001,
    });
  });

  async function seedVerifiedSignupCode(email: string) {
    const emailNormalized = email.toLowerCase();
    const now = await prisma.getDatabaseNow();

    await prisma.verificationCode.create({
      data: {
        emailNormalized,
        purpose: 'SIGNUP',
        codeHash: `hmac-sha256:${emailNormalized}`,
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
        verifiedAt: now,
      },
    });
  }

  async function seedVerifiedStandaloneUser(input: {
    userId: string;
    email: string;
    nickname: string;
  }) {
    const verifiedAt = await prisma.getDatabaseNow();

    await prisma.user.create({
      data: {
        id: input.userId,
        email: input.email,
        emailNormalized: input.email.toLowerCase(),
        passwordHash: 'integration-password-hash',
        gender: 'M',
        campus: 'CHUNCHEON',
        dormitorySelectionState: 'NOT_SELECTED',
        emailVerifiedAt: verifiedAt,
      },
    });

    await prisma.userProfile.create({
      data: {
        userId: input.userId,
        nickname: input.nickname,
        nicknameNormalized: input.nickname,
        ...toLifestyleColumnData(DEFAULT_LIFESTYLE),
        intro: `${input.nickname} 소개`,
        messageToRoommate: `${input.nickname} 메시지`,
      },
    });
  }

  async function setSeasonOverride(
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

  async function loadAuthContext(userId: string): Promise<AuthenticatedUserContext> {
    return prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        gender: true,
        campus: true,
        dormitoryId: true,
        dormitorySelectionState: true,
      },
    });
  }
});
