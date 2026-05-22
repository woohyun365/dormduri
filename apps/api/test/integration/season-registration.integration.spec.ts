import { SERVICE_INTRO_NOTICE_KEY } from '@repo/shared/user-contract';
import { AuthService } from '../../src/auth/auth.service.js';
import type { AuthenticatedUserContext } from '../../src/auth/auth-session.service.js';
import { normalizeEmail } from '../../src/auth/auth.utils.js';
import { PrismaService } from '../../src/common/prisma/prisma.service.js';
import { SeasonParticipantsService } from '../../src/season-participants/season-participants.service.js';
import { seasonParticipantsErrors } from '../../src/season-participants/season-participants.errors.js';
import { UsersService } from '../../src/users/users.service.js';
import { createIntegrationApp } from './support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from './support/integration-db.js';
import {
  buildCompleteSeasonProfileDraft,
  buildIncompleteSeasonProfileDraft,
  seedBaseSeasonFixtures,
} from './support/integration-fixtures.js';
import { withPrismaQueryTraceOnFailure } from './support/integration-query-trace.js';

describe('Season registration split-flow integration', () => {
  jest.setTimeout(60_000);

  let prisma: PrismaService;
  let authService: AuthService;
  let seasonParticipantsService: SeasonParticipantsService;
  let usersService: UsersService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('season_reg');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    authService = app.get(AuthService);
    seasonParticipantsService = app.get(SeasonParticipantsService);
    usersService = app.get(UsersService);
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

  function itWithQueryTrace(testName: string, testFn: () => Promise<void>) {
    it(testName, () => withPrismaQueryTraceOnFailure(prisma, testName, testFn));
  }

  itWithQueryTrace(
    'signup 후 season profile draft와 dormitory selection은 registration finalize 전까지 분리 저장되고 finalize에서만 registered/assigned/history가 생성된다',
    async () => {
      const userId = await signupVerifiedUser({
        email: 'season-registration-success@kangwon.ac.kr',
        nickname: '시즌등록성공',
      });
      const authUser = await loadAuthContext(userId);

      await usersService.dismissCurrentUserOnboardingNotice(authUser, {
        noticeKey: SERVICE_INTRO_NOTICE_KEY,
      });

      const initialCurrentUser = await usersService.getCurrentUser(authUser);
      expect(initialCurrentUser.seasonProfile).toMatchObject({
        hasParticipantRow: false,
        profileState: 'NONE',
        registered: false,
        canSelectDormitory: true,
        canFinalizeRegistration: false,
      });
      expect(initialCurrentUser.onboarding.dismissedNotices).toEqual([
        expect.objectContaining({
          noticeKey: SERVICE_INTRO_NOTICE_KEY,
          dismissed: true,
        }),
      ]);

      const profileDraft = await seasonParticipantsService.createOrUpdateSeasonProfileDraft(
        userId,
        buildCompleteSeasonProfileDraft('최종 등록 전 시즌 프로필'),
      );
      expect(profileDraft).toMatchObject({
        state: 'COMPLETE',
        draftWritable: true,
      });

      const selectable =
        await seasonParticipantsService.listSelectableDormitoriesForCurrentSeason(userId);
      expect(selectable).toMatchObject({
        profileState: 'COMPLETE',
        items: [expect.objectContaining({ id: 'dasan', campusCode: 'CHUNCHEON' })],
      });

      const selected = await seasonParticipantsService.createOrUpdateDormitorySelection(userId, {
        dormitoryId: 'dasan',
      });
      expect(selected).toMatchObject({
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        profileState: 'COMPLETE',
      });

      const preFinalizeParticipant = await prisma.seasonParticipant.findUniqueOrThrow({
        where: { id: selected.participantId },
      });
      expect(preFinalizeParticipant).toMatchObject({
        participationIntent: 'UNDECIDED',
        registeredAt: null,
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        participantStatus: 'DRAFT',
      });
      await expect(
        prisma.seasonParticipantProfileHistory.count({
          where: { participantId: selected.participantId },
        }),
      ).resolves.toBe(0);

      const finalized = await seasonParticipantsService.finalizeSeasonRegistration(userId);
      expect(finalized).toMatchObject({
        participantId: selected.participantId,
        participationIntent: 'REGISTERED',
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        profileState: 'REGISTRATION_FINALIZED',
      });

      const currentUser = await usersService.getCurrentUser(authUser);
      expect(currentUser.seasonProfile).toMatchObject({
        hasParticipantRow: true,
        registered: true,
        profileState: 'REGISTRATION_FINALIZED',
        draftWritable: false,
        canSelectDormitory: false,
        canFinalizeRegistration: false,
      });
      expect(currentUser.selection).toMatchObject({
        state: 'ASSIGNED',
        dormitoryId: 'dasan',
      });
      expect(currentUser.capabilities).toMatchObject({
        canCreateOrUpdateSeasonProfileDraft: false,
        canSelectDormitory: false,
        canFinalizeSeasonRegistration: false,
      });
      expect(currentUser.onboarding.dismissedNotices).toEqual([
        expect.objectContaining({
          noticeKey: SERVICE_INTRO_NOTICE_KEY,
          dismissed: true,
        }),
      ]);
      await expect(
        prisma.seasonParticipantProfileHistory.count({
          where: { participantId: selected.participantId },
        }),
      ).resolves.toBe(1);

      await expect(
        seasonParticipantsService.createOrUpdateDormitorySelection(userId, {
          dormitoryId: 'dasan',
        }),
      ).rejects.toMatchObject({
        response: seasonParticipantsErrors.dormitorySelectionInvalid().getResponse(),
      });
    },
  );

  itWithQueryTrace(
    'dormitory selection을 season profile draft보다 먼저 저장해도 이후 profile 작성 후 registration finalize가 가능하다',
    async () => {
      const userId = await signupVerifiedUser({
        email: 'season-registration-selection-first@kangwon.ac.kr',
        nickname: '선택먼저등록',
      });

      const selected = await seasonParticipantsService.createOrUpdateDormitorySelection(userId, {
        dormitoryId: 'dasan',
      });
      expect(selected).toMatchObject({
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        profileState: 'NONE',
      });

      const preProfileParticipant = await prisma.seasonParticipant.findUniqueOrThrow({
        where: { id: selected.participantId },
      });
      expect(preProfileParticipant).toMatchObject({
        participationIntent: 'UNDECIDED',
        registeredAt: null,
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        participantStatus: 'DRAFT',
      });

      const profileDraft = await seasonParticipantsService.createOrUpdateSeasonProfileDraft(
        userId,
        buildCompleteSeasonProfileDraft('건물 선택 후 작성한 시즌 프로필'),
      );
      expect(profileDraft).toMatchObject({
        state: 'COMPLETE',
        draftWritable: true,
      });
      expect(profileDraft.completion).toMatchObject({
        profileCompletionRequired: false,
        dormitorySelectionRequired: false,
        registrationUnavailable: false,
        registrationUnavailableReasons: [],
      });

      const finalized = await seasonParticipantsService.finalizeSeasonRegistration(userId);
      expect(finalized).toMatchObject({
        participantId: selected.participantId,
        participationIntent: 'REGISTERED',
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        profileState: 'REGISTRATION_FINALIZED',
      });

      await expect(
        prisma.seasonParticipantProfileHistory.count({
          where: { participantId: selected.participantId },
        }),
      ).resolves.toBe(1);
    },
  );

  itWithQueryTrace(
    'incomplete season profile은 dormitory selection 저장 후에도 registration finalize로 진행하지 않는다',
    async () => {
      const userId = await signupVerifiedUser({
        email: 'season-registration-incomplete@kangwon.ac.kr',
        nickname: '미완성등록',
      });

      const profileDraft = await seasonParticipantsService.createOrUpdateSeasonProfileDraft(
        userId,
        buildIncompleteSeasonProfileDraft('미완성 시즌 프로필'),
      );
      expect(profileDraft.completion.registrationUnavailableReasons).toContain(
        'PROFILE_INCOMPLETE',
      );

      const selected = await seasonParticipantsService.createOrUpdateDormitorySelection(userId, {
        dormitoryId: 'dasan',
      });
      expect(selected).toMatchObject({
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        profileState: 'DRAFT',
      });

      await expect(
        seasonParticipantsService.finalizeSeasonRegistration(userId),
      ).rejects.toMatchObject({
        response: seasonParticipantsErrors.registrationSeasonProfileIncomplete().getResponse(),
      });

      const participant = await prisma.seasonParticipant.findUniqueOrThrow({
        where: { id: selected.participantId },
      });
      expect(participant).toMatchObject({
        participationIntent: 'UNDECIDED',
        registeredAt: null,
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
      });
      await expect(
        prisma.seasonParticipantProfileHistory.count({
          where: { participantId: selected.participantId },
        }),
      ).resolves.toBe(0);
    },
  );

  async function signupVerifiedUser(input: { email: string; nickname: string }) {
    await seedVerifiedSignupCode(input.email);

    await expect(
      authService.signup({
        email: input.email,
        password: 'Pass1234',
        nickname: input.nickname,
        gender: 'M',
        campus: 'CHUNCHEON',
      }),
    ).resolves.toMatchObject({ success: true });

    const user = await prisma.user.findUniqueOrThrow({
      where: { emailNormalized: normalizeEmail(input.email) },
      select: { id: true },
    });

    return user.id;
  }

  async function seedVerifiedSignupCode(email: string) {
    const emailNormalized = normalizeEmail(email);
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

  async function loadAuthContext(userId: string): Promise<AuthenticatedUserContext> {
    return prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        gender: true,
        campus: true,
      },
    });
  }
});
