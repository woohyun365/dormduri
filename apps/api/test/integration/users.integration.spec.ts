import { UsersService } from '../../src/users/users.service.js';
import { usersErrors } from '../../src/users/users.errors.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  authContext,
  seedBaseSeasonFixtures,
  seedRegisteredAssignedParticipant,
} from './support/integration-fixtures.js';

describe('UsersService integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let service: UsersService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('users_integration');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    service = app.get(UsersService);
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

    await prisma.seasonParticipant.update({
      where: { id: 'participant-a' },
      data: {
        dormitoryId: null,
        dormitorySelectionState: 'NOT_SELECTED',
        participantStatus: 'DRAFT',
        activatedAt: null,
      },
    });
  });

  it('current user 응답은 season profile lifestyle 본문을 직접 포함하지 않고 상태 segment만 조합한다', async () => {
    const currentUser = await service.getCurrentUser(authContext('user-a'));

    expect(currentUser.user).toMatchObject({
      id: 'user-a',
      email: 'user-a@kangwon.ac.kr',
      nickname: '유저A',
    });
    expect(currentUser.displayIdentity).toMatchObject({
      userId: 'user-a',
      nickname: '유저A',
      nicknameSource: 'USER_DISPLAY_IDENTITY',
    });
    expect(currentUser.seasonProfile).toMatchObject({
      hasParticipantRow: true,
      registered: false,
      profileExists: true,
      profileState: 'COMPLETE',
    });
    expect(currentUser.selection).toMatchObject({
      state: 'NOT_SELECTED',
      dormitoryId: null,
      source: 'SEASON_PARTICIPANT',
    });
    expect(currentUser).not.toHaveProperty('profile');
  });

  it('display identity 수정은 users 도메인만 변경하고 dormitory selection은 건드리지 않는다', async () => {
    await service.updateCurrentUser(authContext('user-a'), {
      displayIdentity: { nickname: '유저변경' },
    });

    const participant = await prisma.seasonParticipant.findUnique({
      where: { id: 'participant-a' },
    });
    const displayIdentity = await prisma.userDisplayIdentity.findUnique({
      where: { userId: 'user-a' },
    });

    expect(participant).toMatchObject({
      dormitoryId: null,
      dormitorySelectionState: 'NOT_SELECTED',
      participantStatus: 'DRAFT',
    });
    expect(participant?.activatedAt).toBeNull();
    expect(displayIdentity).toMatchObject({
      nickname: '유저변경',
      nicknameNormalized: '유저변경',
    });

    const nicknameEvents = await prisma.userDisplayIdentityNicknameChangeEvent.findMany({
      where: { userId: 'user-a' },
      orderBy: { changedAt: 'asc' },
    });
    expect(nicknameEvents).toHaveLength(1);
    expect(nicknameEvents[0]).toMatchObject({
      source: 'USER_SELF',
      reason: 'USER_REQUEST',
      actorType: 'USER',
      actorId: 'user-a',
      previousNickname: '유저A',
      previousNicknameNormalized: '유저A',
      nextNickname: '유저변경',
      nextNicknameNormalized: '유저변경',
      seasonProfileSnapshotUpdated: false,
      reportId: null,
      moderationCaseId: null,
      sanctionId: null,
    });
  });

  it('현재 시즌 registration 완료 사용자의 display identity nickname 변경은 registration snapshot lock으로 거부한다', async () => {
    const now = await prisma.getDatabaseNow();
    await prisma.seasonParticipant.update({
      where: { id: 'participant-a' },
      data: {
        participationIntent: 'REGISTERED',
        registeredAt: now,
        declinedAt: null,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        activatedAt: now,
        withdrawnAt: null,
      },
    });

    await expect(
      service.updateCurrentUser(authContext('user-a'), {
        displayIdentity: { nickname: '등록후변경' },
      }),
    ).rejects.toMatchObject({
      response: usersErrors.nicknameLockedBySeason().getResponse(),
    });

    const currentUser = await service.getCurrentUser(authContext('user-a'));
    expect(currentUser.capabilities).toMatchObject({
      canEditDisplayIdentity: false,
      displayIdentityEditUnavailableReasons: ['CURRENT_SEASON_REGISTRATION_LOCK'],
    });

    const displayIdentity = await prisma.userDisplayIdentity.findUniqueOrThrow({
      where: { userId: 'user-a' },
    });
    expect(displayIdentity.nickname).toBe('유저A');
  });

  it('같은 display identity nickname 저장은 registration snapshot lock 중에도 no-op metadata로 성공한다', async () => {
    const now = await prisma.getDatabaseNow();
    await prisma.userDisplayIdentity.update({
      where: { userId: 'user-a' },
      data: { nicknameNormalized: '유저a' },
    });
    await prisma.seasonParticipant.update({
      where: { id: 'participant-a' },
      data: {
        participationIntent: 'REGISTERED',
        registeredAt: now,
        declinedAt: null,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        activatedAt: now,
        withdrawnAt: null,
      },
    });

    const response = await service.updateCurrentUser(authContext('user-a'), {
      displayIdentity: { nickname: '유저A' },
    });

    expect(response.mutation.displayIdentity).toEqual({
      attempted: true,
      changed: false,
      noOpReason: 'SAME_NICKNAME',
    });
    expect(response.currentUser.displayIdentity.nickname).toBe('유저A');

    const nicknameEventCount = await prisma.userDisplayIdentityNicknameChangeEvent.count({
      where: { userId: 'user-a' },
    });
    expect(nicknameEventCount).toBe(0);
  });

  it('같은 academic identity 저장은 registration snapshot lock 중에도 no-op metadata로 성공한다', async () => {
    const now = await prisma.getDatabaseNow();
    await prisma.seasonParticipant.update({
      where: { id: 'participant-a' },
      data: {
        participationIntent: 'REGISTERED',
        registeredAt: now,
        declinedAt: null,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        activatedAt: now,
        withdrawnAt: null,
      },
    });

    const response = await service.updateCurrentUser(authContext('user-a'), {
      academicIdentity: {
        collegeCode: 'ARTS_ENGINEERING',
        birthYear: 2002,
      },
    } as never);

    expect(response.mutation).toMatchObject({
      displayIdentity: {
        attempted: false,
        changed: false,
        noOpReason: null,
      },
      academicIdentity: {
        attempted: true,
        changed: false,
        noOpReason: 'SAME_ACADEMIC_IDENTITY',
      },
    });
    expect(response.currentUser.academicIdentity).toMatchObject({
      collegeCode: 'ARTS_ENGINEERING',
      birthYear: 2002,
    });
  });

  it('academic college allowance row가 없으면 college 변경 요청 transaction에서 current cycle row를 lazy create 후 차감한다', async () => {
    const season = await prisma.season.findUniqueOrThrow({
      where: { id: 'season-integration' },
      select: { academicYear: true },
    });
    await prisma.collegeMaster.create({
      data: {
        code: 'NURSING',
        campusCode: 'CHUNCHEON',
        nameKo: '간호대학',
        sortOrder: 2,
      },
    });
    await prisma.userAcademicIdentityChangeAllowance.delete({
      where: { userId: 'user-a' },
    });

    const response = await service.updateCurrentUser(authContext('user-a'), {
      academicIdentity: {
        collegeCode: 'NURSING',
        birthYear: 2002,
      },
    } as never);

    expect(response.mutation.academicIdentity).toEqual({
      attempted: true,
      changed: true,
      noOpReason: null,
    });
    expect(response.currentUser.academicIdentity).toMatchObject({
      collegeCode: 'NURSING',
      birthYear: 2002,
    });

    const allowance = await prisma.userAcademicIdentityChangeAllowance.findUniqueOrThrow({
      where: { userId: 'user-a' },
    });
    expect(allowance).toMatchObject({
      academicYear: season.academicYear,
      collegeChangeRemaining: 0,
      resetReason: 'INITIAL_CYCLE_ALLOWANCE',
    });

    const auditEvents = await prisma.userAcademicIdentityChangeEvent.findMany({
      where: { userId: 'user-a' },
      orderBy: { changedAt: 'asc' },
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      source: 'USER_SELF',
      reason: 'ACADEMIC_CYCLE_ALLOWANCE',
      actorType: 'USER',
      actorId: 'user-a',
      previousCollegeCode: 'ARTS_ENGINEERING',
      nextCollegeCode: 'NURSING',
      previousBirthYear: 2002,
      nextBirthYear: 2002,
    });
  });

  it('이전 academic cycle allowance row는 college 변경 요청 transaction에서 current cycle로 lazy rollover 후 차감한다', async () => {
    const season = await prisma.season.findUniqueOrThrow({
      where: { id: 'season-integration' },
      select: { academicYear: true },
    });
    await prisma.collegeMaster.create({
      data: {
        code: 'NURSING',
        campusCode: 'CHUNCHEON',
        nameKo: '간호대학',
        sortOrder: 2,
      },
    });
    await prisma.userAcademicIdentityChangeAllowance.update({
      where: { userId: 'user-a' },
      data: {
        academicYear: season.academicYear - 1,
        collegeChangeRemaining: 0,
        resetReason: 'INITIAL_CYCLE_ALLOWANCE',
      },
    });

    const response = await service.updateCurrentUser(authContext('user-a'), {
      academicIdentity: {
        collegeCode: 'NURSING',
        birthYear: 2002,
      },
    } as never);

    expect(response.mutation.academicIdentity).toEqual({
      attempted: true,
      changed: true,
      noOpReason: null,
    });

    const allowance = await prisma.userAcademicIdentityChangeAllowance.findUniqueOrThrow({
      where: { userId: 'user-a' },
    });
    expect(allowance).toMatchObject({
      academicYear: season.academicYear,
      collegeChangeRemaining: 0,
      resetReason: 'ACADEMIC_CYCLE_ROLLOVER',
    });
  });

  it('동시에 두 college correction 요청이 들어와도 academic cycle allowance는 한 번만 소비된다', async () => {
    await prisma.collegeMaster.createMany({
      data: [
        {
          code: 'NURSING',
          campusCode: 'CHUNCHEON',
          nameKo: '간호대학',
          sortOrder: 2,
        },
        {
          code: 'BUSINESS',
          campusCode: 'CHUNCHEON',
          nameKo: '경영대학',
          sortOrder: 3,
        },
      ],
    });

    const results = await Promise.allSettled([
      service.updateCurrentUser(authContext('user-a'), {
        academicIdentity: {
          collegeCode: 'NURSING',
          birthYear: 2002,
        },
      } as never),
      service.updateCurrentUser(authContext('user-a'), {
        academicIdentity: {
          collegeCode: 'BUSINESS',
          birthYear: 2002,
        },
      } as never),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: {
        response: usersErrors.academicCollegeChangeAllowanceExhausted().getResponse(),
      },
    });

    const [academicIdentity, allowance, auditEventCount] = await Promise.all([
      prisma.userAcademicIdentity.findUniqueOrThrow({ where: { userId: 'user-a' } }),
      prisma.userAcademicIdentityChangeAllowance.findUniqueOrThrow({
        where: { userId: 'user-a' },
      }),
      prisma.userAcademicIdentityChangeEvent.count({ where: { userId: 'user-a' } }),
    ]);
    expect(['NURSING', 'BUSINESS']).toContain(academicIdentity.collegeCode);
    expect(allowance.collegeChangeRemaining).toBe(0);
    expect(auditEventCount).toBe(1);
  });

  it('policy enforcement nickname override는 registered snapshot과 운영 감사 이력을 함께 남긴다', async () => {
    const now = await prisma.getDatabaseNow();
    await prisma.seasonParticipant.update({
      where: { id: 'participant-a' },
      data: {
        participationIntent: 'REGISTERED',
        registeredAt: now,
        declinedAt: null,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        activatedAt: now,
        withdrawnAt: null,
      },
    });

    const result = await service.overrideDisplayIdentityNicknameForPolicyEnforcement({
      userId: 'user-a',
      nickname: '운영변경',
      actorId: 'admin-1',
      reason: 'REPORT_REVIEW',
      reportId: 'report-1',
      moderationCaseId: 'moderation-case-1',
      sanctionId: 'sanction-1',
      approvalReference: 'approval-1',
      metadata: {
        note: 'manual report review nickname replacement',
      },
    });

    expect(result.override).toMatchObject({
      actorId: 'admin-1',
      actorType: 'ADMIN',
      reason: 'REPORT_REVIEW',
    });
    expect(typeof result.override.auditEventId).toBe('string');
    expect(result.override.auditEventId.length).toBeGreaterThan(0);

    const displayIdentity = await prisma.userDisplayIdentity.findUniqueOrThrow({
      where: { userId: 'user-a' },
    });
    expect(displayIdentity.nickname).toBe('운영변경');

    const profile = await prisma.seasonParticipantProfile.findUniqueOrThrow({
      where: { participantId: 'participant-a' },
    });
    expect(profile.nicknameSnapshot).toBe('운영변경');

    const nicknameEvent = await prisma.userDisplayIdentityNicknameChangeEvent.findUniqueOrThrow({
      where: { id: result.override.auditEventId },
    });
    expect(nicknameEvent).toMatchObject({
      userId: 'user-a',
      source: 'POLICY_ENFORCEMENT',
      reason: 'REPORT_REVIEW',
      actorType: 'ADMIN',
      actorId: 'admin-1',
      previousNickname: '유저A',
      previousNicknameNormalized: '유저A',
      nextNickname: '운영변경',
      nextNicknameNormalized: '운영변경',
      seasonId: 'season-integration',
      participantId: 'participant-a',
      seasonProfileSnapshotUpdated: true,
      reportId: 'report-1',
      moderationCaseId: 'moderation-case-1',
      sanctionId: 'sanction-1',
      approvalReference: 'approval-1',
    });
  });

  it('철회된 사용자는 같은 시즌 재등록 불가 상태이므로 display identity nickname 변경은 다시 허용한다', async () => {
    const now = await prisma.getDatabaseNow();
    await prisma.seasonParticipant.update({
      where: { id: 'participant-a' },
      data: {
        participationIntent: 'DECLINED',
        declinedAt: now,
        participantStatus: 'WITHDRAWN',
        withdrawnAt: now,
      },
    });

    await service.updateCurrentUser(authContext('user-a'), {
      displayIdentity: { nickname: '철회후변경' },
    });

    const displayIdentity = await prisma.userDisplayIdentity.findUniqueOrThrow({
      where: { userId: 'user-a' },
    });
    expect(displayIdentity.nickname).toBe('철회후변경');
  });
});
