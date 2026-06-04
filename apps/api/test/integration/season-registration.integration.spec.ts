import { SERVICE_INTRO_NOTICE_KEY } from '@repo/shared/user-contract';
import { AuthService } from '../../src/auth/application/auth.service.js';
import type { AuthenticatedUserContext } from '../../src/auth/sessions/auth-session.service.js';
import { normalizeEmail } from '../../src/auth/domain/auth.utils.js';
import { PrismaService } from '../../src/platform/database/prisma.service.js';
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
  disableSeasonDormitoryOperationFixture,
  moveSeasonDormitorySelectionCutoffToPastFixture,
  seedBaseSeasonFixtures,
  seedOperatedDormitoryFixture,
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
    await prisma.collegeMaster.create({
      data: {
        code: 'IT',
        campusCode: 'CHUNCHEON',
        nameKo: 'IT대',
        sortOrder: 1,
      },
    });
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
      expect(profileDraft.participantId).toEqual(expect.any(String));
      const profileDraftParticipantId = profileDraft.participantId;
      if (!profileDraftParticipantId) {
        throw new Error('profile draft participantId is required after draft persistence');
      }
      const afterProfileDraftParticipant = await prisma.seasonParticipant.findUniqueOrThrow({
        where: { id: profileDraftParticipantId },
      });
      expect(afterProfileDraftParticipant).toMatchObject({
        participationIntent: 'UNDECIDED',
        registeredAt: null,
        participantStatus: 'DRAFT',
      });
      await expect(
        prisma.seasonParticipantProfile.count({
          where: { participantId: profileDraftParticipantId },
        }),
      ).resolves.toBe(1);
      await expect(
        prisma.seasonParticipantProfileHistory.count({
          where: { participantId: profileDraftParticipantId },
        }),
      ).resolves.toBe(0);

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

      const draftOnlyParticipant = await prisma.seasonParticipant.findUniqueOrThrow({
        where: { id: selected.participantId },
      });
      expect(draftOnlyParticipant).toMatchObject({
        participationIntent: 'UNDECIDED',
        registeredAt: null,
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        participantStatus: 'DRAFT',
      });
      await expect(
        prisma.seasonParticipantProfile.count({
          where: { participantId: selected.participantId },
        }),
      ).resolves.toBe(1);
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

      await expect(
        prisma.seasonParticipantProfileHistory.count({
          where: { participantId: selected.participantId },
        }),
      ).resolves.toBe(1);
    },
  );

  itWithQueryTrace(
    'profile draft persistence가 transaction 내부에서 실패하면 participant row와 history가 남지 않는다',
    async () => {
      const userId = await signupVerifiedUser({
        email: 'season-registration-profile-rollback@kangwon.ac.kr',
        nickname: '프로필롤백',
      });

      await expect(
        seasonParticipantsService.createOrUpdateSeasonProfileDraft(userId, {
          ...buildCompleteSeasonProfileDraft('저장 실패 시즌 프로필'),
          lifestyle: {
            ...buildCompleteSeasonProfileDraft().lifestyle,
            bedtime: 'INVALID_BEDTIME' as never,
          },
        }),
      ).rejects.toBeTruthy();

      await expectCurrentSeasonParticipantMissing(userId);
      await expectTotalHistoryCount(0);
    },
  );

  itWithQueryTrace(
    'invalid dormitory selection submit은 participant ensure까지 rollback하고 registration/history를 만들지 않는다',
    async () => {
      const userId = await signupVerifiedUser({
        email: 'season-registration-selection-rollback@kangwon.ac.kr',
        nickname: '선택롤백',
      });

      await expect(
        seasonParticipantsService.createOrUpdateDormitorySelection(userId, {
          dormitoryId: 'missing-dormitory',
        }),
      ).rejects.toMatchObject({
        response: seasonParticipantsErrors.dormitorySelectionInvalid().getResponse(),
      });

      await expectCurrentSeasonParticipantMissing(userId);
      await expectTotalHistoryCount(0);
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

  itWithQueryTrace(
    'saved dormitory selection이 operation disabled로 stale해지면 finalize는 rollback되고 draft 상태만 남는다',
    async () => {
      const { participantId } = await prepareRegistrationCandidate({
        email: 'season-registration-stale-disabled@kangwon.ac.kr',
        nickname: '운영중단등록',
      });

      await disableSeasonDormitoryOperationFixture(prisma);

      await expect(
        seasonParticipantsService.finalizeSeasonRegistration(
          await findUserIdByEmail('season-registration-stale-disabled@kangwon.ac.kr'),
        ),
      ).rejects.toMatchObject({
        response: seasonParticipantsErrors.dormitorySelectionInvalid().getResponse(),
      });
      await expectRegistrationDraftOnly(participantId, 'dasan');
    },
  );

  itWithQueryTrace(
    'saved dormitory selection이 cutoff 이후 stale해지면 finalize는 registered/assigned/history를 만들지 않는다',
    async () => {
      await seedOperatedDormitoryFixture(prisma, {
        id: 'saerom',
        nameKo: '새롬관',
        genderPolicy: 'BOTH',
        sortOrder: 2,
      });
      const { userId, participantId } = await prepareRegistrationCandidate({
        email: 'season-registration-stale-cutoff@kangwon.ac.kr',
        nickname: '마감등록',
      });
      await moveSeasonDormitorySelectionCutoffToPastFixture(prisma);

      await expect(
        seasonParticipantsService.finalizeSeasonRegistration(userId),
      ).rejects.toMatchObject({
        response: seasonParticipantsErrors.dormitorySelectionInvalid().getResponse(),
      });
      await expectRegistrationDraftOnly(participantId, 'dasan');
    },
  );

  itWithQueryTrace(
    'withdrawn/declined participant는 같은 season에서 재등록 finalize가 거부되고 history가 생기지 않는다',
    async () => {
      const { userId, participantId } = await prepareRegistrationCandidate({
        email: 'season-registration-withdrawn@kangwon.ac.kr',
        nickname: '철회등록',
      });
      const now = await prisma.getDatabaseNow();

      await prisma.seasonParticipant.update({
        where: { id: participantId },
        data: {
          participationIntent: 'DECLINED',
          declinedAt: now,
          participantStatus: 'WITHDRAWN',
          withdrawnAt: now,
        },
      });

      await expect(
        seasonParticipantsService.finalizeSeasonRegistration(userId),
      ).rejects.toMatchObject({
        response: seasonParticipantsErrors.registrationNotAllowed().getResponse(),
      });

      const participant = await prisma.seasonParticipant.findUniqueOrThrow({
        where: { id: participantId },
      });
      expect(participant).toMatchObject({
        participationIntent: 'DECLINED',
        registeredAt: null,
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        participantStatus: 'WITHDRAWN',
      });
      await expectHistoryCount(participantId, 0);
    },
  );

  itWithQueryTrace(
    'deleted/deactivated/hidden 상태가 finalize 전에 감지되면 registration mutation과 history를 만들지 않는다',
    async () => {
      const cases = [
        {
          suffix: 'deleted',
          nickname: '삭제비활성',
          applyInactiveState: async (userId: string) => {
            await prisma.user.update({
              where: { id: userId },
              data: { deletedAt: await prisma.getDatabaseNow() },
            });
          },
        },
        {
          suffix: 'deactivated',
          nickname: '중지비활성',
          applyInactiveState: async (_userId: string, participantId: string) => {
            await prisma.seasonParticipant.update({
              where: { id: participantId },
              data: { deactivatedAt: await prisma.getDatabaseNow() },
            });
          },
        },
        {
          suffix: 'hidden',
          nickname: '숨김비활성',
          applyInactiveState: async (_userId: string, participantId: string) => {
            await prisma.seasonParticipant.update({
              where: { id: participantId },
              data: {
                hiddenByAdminAt: await prisma.getDatabaseNow(),
                hiddenReasonCode: 'ADMIN_REQUEST',
              },
            });
          },
        },
      ];

      for (const testCase of cases) {
        await truncateIntegrationSchema(prisma);
        await seedBaseSeasonFixtures(prisma);
        const { userId, participantId } = await prepareRegistrationCandidate({
          email: `season-registration-${testCase.suffix}@kangwon.ac.kr`,
          nickname: testCase.nickname,
        });

        await testCase.applyInactiveState(userId, participantId);

        await expect(
          seasonParticipantsService.finalizeSeasonRegistration(userId),
        ).rejects.toMatchObject({
          response: seasonParticipantsErrors.registrationNotAllowed().getResponse(),
        });
        await expectRegistrationDraftOnly(participantId, 'dasan');
      }
    },
  );

  itWithQueryTrace(
    '이미 등록된 participant는 deleted/deactivated/hidden 이후에도 registration history snapshot을 보존한다',
    async () => {
      const cases: Array<{
        suffix: string;
        nickname: string;
        applyPostRegistrationState: (userId: string, participantId: string) => Promise<void>;
      }> = [
        {
          suffix: 'post-delete',
          nickname: '등록후삭제',
          applyPostRegistrationState: async (userId) => {
            await prisma.user.update({
              where: { id: userId },
              data: { deletedAt: await prisma.getDatabaseNow() },
            });
          },
        },
        {
          suffix: 'post-deactivate',
          nickname: '등록후중지',
          applyPostRegistrationState: async (_userId, participantId) => {
            await prisma.seasonParticipant.update({
              where: { id: participantId },
              data: { deactivatedAt: await prisma.getDatabaseNow() },
            });
          },
        },
        {
          suffix: 'post-hide',
          nickname: '등록후숨김',
          applyPostRegistrationState: async (_userId, participantId) => {
            await prisma.seasonParticipant.update({
              where: { id: participantId },
              data: {
                hiddenByAdminAt: await prisma.getDatabaseNow(),
                hiddenReasonCode: 'ADMIN_REQUEST',
              },
            });
          },
        },
      ];

      for (const testCase of cases) {
        await truncateIntegrationSchema(prisma);
        await seedBaseSeasonFixtures(prisma);
        const { userId, participantId } = await prepareRegistrationCandidate({
          email: `season-registration-${testCase.suffix}@kangwon.ac.kr`,
          nickname: testCase.nickname,
        });

        await seasonParticipantsService.finalizeSeasonRegistration(userId);
        const beforeHistory = await expectOnlyRegistrationHistory(participantId);

        await testCase.applyPostRegistrationState(userId, participantId);

        const afterHistory = await expectOnlyRegistrationHistory(participantId);
        expect(afterHistory).toEqual(beforeHistory);
      }
    },
  );

  itWithQueryTrace(
    'selection draft를 변경하면 finalize는 최신 selection만 ASSIGNED로 확정한다',
    async () => {
      await seedOperatedDormitoryFixture(prisma, {
        id: 'saerom',
        nameKo: '새롬관',
        genderPolicy: 'BOTH',
        sortOrder: 2,
      });
      const userId = await signupVerifiedUser({
        email: 'season-registration-selection-change@kangwon.ac.kr',
        nickname: '선택변경등록',
      });

      await seasonParticipantsService.createOrUpdateSeasonProfileDraft(
        userId,
        buildCompleteSeasonProfileDraft('선택 변경 시즌 프로필'),
      );
      const first = await seasonParticipantsService.createOrUpdateDormitorySelection(userId, {
        dormitoryId: 'dasan',
      });
      const second = await seasonParticipantsService.createOrUpdateDormitorySelection(userId, {
        dormitoryId: 'saerom',
      });

      expect(second.participantId).toBe(first.participantId);
      const finalized = await seasonParticipantsService.finalizeSeasonRegistration(userId);

      expect(finalized).toMatchObject({
        participantId: first.participantId,
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: 'saerom',
      });
      const participant = await prisma.seasonParticipant.findUniqueOrThrow({
        where: { id: first.participantId },
      });
      expect(participant).toMatchObject({
        participationIntent: 'REGISTERED',
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: 'saerom',
      });
      expect(participant.registeredAt).toBeInstanceOf(Date);
      await expectHistoryCount(first.participantId, 1);
    },
  );

  itWithQueryTrace(
    'selection 변경과 finalize가 동시에 실행되어도 하나의 serial outcome과 history 1건 이하만 남는다',
    async () => {
      await seedOperatedDormitoryFixture(prisma, {
        id: 'saerom',
        nameKo: '새롬관',
        genderPolicy: 'BOTH',
        sortOrder: 2,
      });
      const { userId, participantId } = await prepareRegistrationCandidate({
        email: 'season-registration-selection-finalize-race@kangwon.ac.kr',
        nickname: '선택동시등록',
      });

      const results = await Promise.allSettled([
        seasonParticipantsService.createOrUpdateDormitorySelection(userId, {
          dormitoryId: 'saerom',
        }),
        seasonParticipantsService.finalizeSeasonRegistration(userId),
      ]);

      const participant = await prisma.seasonParticipant.findUniqueOrThrow({
        where: { id: participantId },
      });
      const historyCount = await prisma.seasonParticipantProfileHistory.count({
        where: { participantId },
      });
      const successCount = results.filter((result) => result.status === 'fulfilled').length;

      expect(successCount).toBeGreaterThanOrEqual(1);
      expect(historyCount).toBeLessThanOrEqual(1);
      if (participant.participationIntent === 'REGISTERED') {
        expect(participant).toMatchObject({
          dormitorySelectionState: 'ASSIGNED',
          participantStatus: 'ACTIVE',
        });
        expect(participant.registeredAt).toBeInstanceOf(Date);
        expect(['dasan', 'saerom']).toContain(participant.dormitoryId);
        expect(historyCount).toBe(1);
      } else {
        expect(participant).toMatchObject({
          participationIntent: 'UNDECIDED',
          registeredAt: null,
          dormitorySelectionState: 'SELECTED',
          dormitoryId: 'saerom',
          participantStatus: 'DRAFT',
        });
        expect(historyCount).toBe(0);
      }
    },
  );

  itWithQueryTrace(
    'duplicate finalize race에서도 SeasonParticipantProfileHistory는 한 번만 생성된다',
    async () => {
      const { userId, participantId } = await prepareRegistrationCandidate({
        email: 'season-registration-duplicate@kangwon.ac.kr',
        nickname: '중복등록',
      });

      const results = await Promise.allSettled([
        seasonParticipantsService.finalizeSeasonRegistration(userId),
        seasonParticipantsService.finalizeSeasonRegistration(userId),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      await expectHistoryCount(participantId, 1);
      const participant = await prisma.seasonParticipant.findUniqueOrThrow({
        where: { id: participantId },
      });
      expect(participant).toMatchObject({
        participationIntent: 'REGISTERED',
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
      });
      expect(participant.registeredAt).toBeInstanceOf(Date);
    },
  );

  itWithQueryTrace(
    'finalize 실패 후 current-user capability는 등록 완료로 보이지 않고 selection draft 변경 가능 상태를 유지한다',
    async () => {
      const { userId, participantId } = await prepareRegistrationCandidate({
        email: 'season-registration-capability-after-fail@kangwon.ac.kr',
        nickname: '실패후상태',
      });
      const authUser = await loadAuthContext(userId);

      await disableSeasonDormitoryOperationFixture(prisma);

      await expect(
        seasonParticipantsService.finalizeSeasonRegistration(userId),
      ).rejects.toMatchObject({
        response: seasonParticipantsErrors.dormitorySelectionInvalid().getResponse(),
      });

      const currentUser = await usersService.getCurrentUser(authUser);
      expect(currentUser.seasonProfile).toMatchObject({
        registered: false,
        profileState: 'COMPLETE',
        draftWritable: true,
        canSelectDormitory: false,
        canFinalizeRegistration: false,
      });
      expect(currentUser.selection).toMatchObject({
        state: 'SELECTED',
        dormitoryId: 'dasan',
      });
      await expectRegistrationDraftOnly(participantId, 'dasan');
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
        collegeCode: 'ARTS_ENGINEERING',
        birthYear: 2002,
      } as never),
    ).resolves.toMatchObject({ success: true });

    const user = await prisma.user.findUniqueOrThrow({
      where: { emailNormalized: normalizeEmail(input.email) },
      select: { id: true },
    });

    return user.id;
  }

  async function findUserIdByEmail(email: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { emailNormalized: normalizeEmail(email) },
      select: { id: true },
    });

    return user.id;
  }

  async function prepareRegistrationCandidate(input: { email: string; nickname: string }) {
    const userId = await signupVerifiedUser(input);
    await seasonParticipantsService.createOrUpdateSeasonProfileDraft(
      userId,
      buildCompleteSeasonProfileDraft(`${input.nickname} 시즌 프로필`),
    );
    const selected = await seasonParticipantsService.createOrUpdateDormitorySelection(userId, {
      dormitoryId: 'dasan',
    });

    await expectHistoryCount(selected.participantId, 0);

    return {
      userId,
      participantId: selected.participantId,
    };
  }

  async function expectRegistrationDraftOnly(participantId: string, dormitoryId: string) {
    const participant = await prisma.seasonParticipant.findUniqueOrThrow({
      where: { id: participantId },
    });

    expect(participant).toMatchObject({
      participationIntent: 'UNDECIDED',
      registeredAt: null,
      dormitorySelectionState: 'SELECTED',
      dormitoryId,
      participantStatus: 'DRAFT',
    });
    await expectHistoryCount(participantId, 0);
  }

  async function expectHistoryCount(participantId: string, expected: number) {
    await expect(
      prisma.seasonParticipantProfileHistory.count({
        where: { participantId },
      }),
    ).resolves.toBe(expected);
  }

  async function expectOnlyRegistrationHistory(participantId: string) {
    const histories = await prisma.seasonParticipantProfileHistory.findMany({
      where: { participantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        participantId: true,
        seasonId: true,
        source: true,
        registeredAtSnapshot: true,
        nicknameSnapshot: true,
        intro: true,
        createdAt: true,
      },
    });

    expect(histories).toHaveLength(1);
    const history = histories.at(0);
    if (!history) {
      throw new Error(`Expected one registration history for participant ${participantId}`);
    }
    expect(history).toMatchObject({
      participantId,
      seasonId: 'season-integration',
      source: 'SEASON_REGISTRATION',
    });
    expect(history.registeredAtSnapshot).toBeInstanceOf(Date);

    return history;
  }

  async function expectTotalHistoryCount(expected: number) {
    await expect(prisma.seasonParticipantProfileHistory.count()).resolves.toBe(expected);
  }

  async function expectCurrentSeasonParticipantMissing(userId: string) {
    await expect(
      prisma.seasonParticipant.findUnique({
        where: {
          seasonId_userId: {
            seasonId: 'season-integration',
            userId,
          },
        },
      }),
    ).resolves.toBeNull();
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
