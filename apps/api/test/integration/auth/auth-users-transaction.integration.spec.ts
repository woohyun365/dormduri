import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { HttpException } from '@nestjs/common';
import { AuthService } from '../../../src/auth/application/auth.service.js';
import { AuthSessionService } from '../../../src/auth/sessions/auth-session.service.js';
import { AuthSecurityEventService } from '../../../src/auth/security-events/auth-security-event.service.js';
import { AuthMailOutboxWriter } from '../../../src/auth/mail/auth-mail-outbox-writer.service.js';
import { signup as signupWithOwner } from '../../../src/auth/registration/signup.command.js';
import { resetPassword as resetPasswordWithOwner } from '../../../src/auth/credentials/reset-password.command.js';
import {
  hashPassword,
  verifyPasswordHash,
} from '../../../src/auth/application/auth-password-hash.js';
import { normalizeEmail, normalizeNickname } from '../../../src/auth/domain/auth.utils.js';
import { hashVerificationGrant } from '../../../src/auth/verification/auth-verification-grant.js';
import { hashAuthPersistenceDimension } from '../../../src/auth/persistence/auth-persistence-dimension.js';
import { DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET } from '../../../src/config/auth.config.js';
import { PrismaService } from '../../../src/platform/database/prisma.service.js';
import type { Prisma } from '../../../src/generated/prisma/client.js';
import type { CurrentUserViewService } from '../../../src/users/current-user/current-user-view.service.js';
import { createUserUpdateOwner } from '../../../src/users/application/user-update-owner.js';
import { DisplayIdentityNicknamePolicyService } from '../../../src/users/identity/display/display-identity-nickname-policy.service.js';
import { DisplayIdentityRepository } from '../../../src/users/identity/display/display-identity.repository.js';
import { UsersService } from '../../../src/users/application/users.service.js';
import { SeasonsService } from '../../../src/seasons/application/seasons.service.js';
import { SERVICE_INTRO_NOTICE_KEY, type CurrentUserResponse } from '@repo/shared/user';
import { createIntegrationApp } from '../_support/integration-app.js';
import {
  createIntegrationDatabaseSandbox,
  truncateIntegrationSchema,
} from '../_support/integration-db.js';
import { withPrismaQueryTraceOnFailure } from '../_support/integration-query-trace.js';
import {
  toCompleteLifestyleColumnData,
  DEFAULT_LIFESTYLE,
  seedBaseSeasonFixtures,
} from '../_support/integration-fixtures.js';

type AuthContext = {
  id: string;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
};

const signupLegalDocumentIds = {
  termsVersionId: 'auth-users-transaction-terms',
  privacyPolicyVersionIdShown: 'auth-users-transaction-privacy',
  personalDataConsentVersionId: 'auth-users-transaction-personal-data-consent',
  ageNoticeVersionId: 'auth-users-transaction-age-notice',
} as const;

describe('Auth/users transaction rollback and race integration', () => {
  let prisma: PrismaService;
  let authService: AuthService;
  let authSessionService: AuthSessionService;
  let authSecurityEventService: AuthSecurityEventService;
  let authMailOutboxWriter: AuthMailOutboxWriter;
  let usersService: UsersService;
  let seasonsService: SeasonsService;
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const sandbox = await createIntegrationDatabaseSandbox('auth_users_transaction');
    cleanupDb = sandbox.cleanup;

    const { app, prisma: prismaService } = await createIntegrationApp();
    closeApp = () => app.close();
    prisma = prismaService;
    authService = app.get(AuthService);
    authSessionService = app.get(AuthSessionService);
    authSecurityEventService = app.get(AuthSecurityEventService);
    authMailOutboxWriter = app.get(AuthMailOutboxWriter);
    usersService = app.get(UsersService);
    seasonsService = app.get(SeasonsService);
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
  });

  function itWithQueryTrace(testName: string, testFn: () => Promise<void>) {
    it(testName, () => withPrismaQueryTraceOnFailure(prisma, testName, testFn));
  }

  itWithQueryTrace(
    'verified user라도 UserAcademicIdentity가 없으면 current-user는 계정 invariant 위반으로 fail-closed한다',
    async () => {
      await seedBaseSeasonFixtures(prisma);
      await seedUserWithDisplayIdentity({
        id: 'academic-missing-user',
        email: 'academic-missing@kangwon.ac.kr',
        nickname: '학업미입력',
        withAcademicIdentity: false,
      });

      let invariantError: unknown = null;
      try {
        await usersService.getCurrentUser(authContext('academic-missing-user'));
      } catch (error) {
        invariantError = error;
      }

      expect(getHttpExceptionCode(invariantError)).toBe('ACCOUNT_IDENTITY_INCOMPLETE');
      expect(getHttpExceptionBody(invariantError)).toMatchObject({
        invariant: 'USER_ACADEMIC_IDENTITY_REQUIRED',
        surface: 'current-user',
      });
    },
  );

  itWithQueryTrace(
    'verified user라도 UserDisplayIdentity가 없으면 current-user는 계정 invariant 위반으로 fail-closed한다',
    async () => {
      await prisma.user.create({
        data: {
          id: 'display-missing-user',
          email: 'display-missing@kangwon.ac.kr',
          emailNormalized: normalizeEmail('display-missing@kangwon.ac.kr'),
          passwordHash: 'integration-password-hash',
          gender: 'M',
          campus: 'CHUNCHEON',
          emailVerifiedAt: await prisma.getDatabaseNow(),
        },
      });

      let invariantError: unknown = null;
      try {
        await usersService.getCurrentUser(authContext('display-missing-user'));
      } catch (error) {
        invariantError = error;
      }

      expect(getHttpExceptionCode(invariantError)).toBe('ACCOUNT_IDENTITY_INCOMPLETE');
      expect(getHttpExceptionBody(invariantError)).toMatchObject({
        invariant: 'USER_DISPLAY_IDENTITY_REQUIRED',
        surface: 'current-user',
      });
    },
  );

  describe('signup rollback / atomicity', () => {
    itWithQueryTrace(
      'signup finalize transaction은 UserAcademicIdentity를 User/DisplayIdentity/AuthSession과 함께 생성한다',
      async () => {
        const email = 'signup-academic-identity@kangwon.ac.kr';
        const emailNormalized = normalizeEmail(email);
        const verificationCodeId = 'signup-academic-identity-code';

        await seedAcademicIdentityReferenceData();
        const verificationGrant = await seedVerifiedCode({
          id: verificationCodeId,
          emailNormalized,
          purpose: 'SIGNUP',
        });

        await expect(
          authService.signup(
            {
              email,
              password: 'Pass1234',
              nickname: '학업가입',
              gender: 'M',
              campus: 'CHUNCHEON',
              collegeCode: 'CHUNCHEON_IT',
              birthYear: 2002,
              legalAcceptances: signupLegalDocumentIds,
            } as never,
            verificationGrant,
          ),
        ).resolves.toMatchObject({ success: true });

        const createdUser = await prisma.user.findUniqueOrThrow({
          where: { emailNormalized },
          select: { id: true },
        });
        const academicIdentityDelegate = (
          prisma as unknown as {
            userAcademicIdentity?: {
              findUnique(args: {
                where: {
                  userId: string;
                };
              }): Promise<unknown>;
            };
          }
        ).userAcademicIdentity;

        expect(academicIdentityDelegate).toBeDefined();
        if (!academicIdentityDelegate) {
          throw new Error('UserAcademicIdentity delegate is not available');
        }

        await expect(
          academicIdentityDelegate.findUnique({
            where: { userId: createdUser.id },
          }),
        ).resolves.toMatchObject({
          collegeCode: 'CHUNCHEON_IT',
          birthYear: 2002,
        });
        await expectVerificationConsumed(verificationCodeId, true);
      },
    );

    itWithQueryTrace(
      'preflight가 아니라 UserDisplayIdentity DB unique 충돌로 signup이 실패하면 신규 User/AcademicIdentity/AuthSession/proof consume이 남지 않는다',
      async () => {
        const email = 'signup-rollback@kangwon.ac.kr';
        const emailNormalized = normalizeEmail(email);
        const nickname = '원자닉';
        const nicknameNormalized = normalizeNickname(nickname);
        const verificationCodeId = 'signup-rollback-code';
        const gate = createGate();

        await seedAcademicIdentityReferenceData();
        const verificationGrant = await seedVerifiedCode({
          id: verificationCodeId,
          emailNormalized,
          purpose: 'SIGNUP',
        });

        const signupPromise = signupWithOwner(
          {
            prisma,
            verificationService: {
              async resolveVerificationGrant() {
                await gate.block();
                return resolvedGrant({
                  id: verificationCodeId,
                  emailNormalized,
                  purpose: 'SIGNUP',
                  verificationGrant,
                });
              },
              matchesVerificationGrantSubject: verificationGrantSubjectMatches,
            },
            sessionService: authSessionService,
            nicknamePolicy: {
              validate(inputNickname: string) {
                return Promise.resolve({
                  ok: true,
                  value: inputNickname,
                  normalized: normalizeNickname(inputNickname),
                  script: 'HANGUL',
                });
              },
            },
          },
          {
            email,
            password: 'Pass1234',
            nickname,
            gender: 'M',
            campus: 'CHUNCHEON',
            collegeCode: 'CHUNCHEON_IT',
            birthYear: 2002,
            legalAcceptances: signupLegalDocumentIds,
          } as never,
          verificationGrant,
        );

        await gate.waitUntilBlocked();
        await seedUserWithDisplayIdentity({
          id: 'existing-nickname-owner',
          email: 'existing-nickname-owner@kangwon.ac.kr',
          nickname,
        });
        gate.release();

        await expect(signupPromise).resolves.toMatchObject({
          success: false,
          code: 'AUTH_NICKNAME_ALREADY_TAKEN',
        });

        await expect(expectUserAuthFootprint(emailNormalized)).resolves.toEqual({
          users: 0,
          displayIdentities: 0,
          academicIdentities: 0,
          authSessions: 0,
        });
        await expect(
          prisma.userDisplayIdentity.count({ where: { nicknameNormalized } }),
        ).resolves.toBe(1);
        await expectVerificationConsumed(verificationCodeId, false);
      },
    );

    itWithQueryTrace(
      '같은 verified signup code를 동시에 소비해도 성공은 최대 1개이고 실패 요청은 User/DisplayIdentity/AcademicIdentity/AuthSession을 남기지 않는다',
      async () => {
        const email = 'signup-code-race@kangwon.ac.kr';
        const emailNormalized = normalizeEmail(email);
        const verificationCodeId = 'signup-code-race-proof';
        await seedAcademicIdentityReferenceData();
        const verificationGrant = await seedVerifiedCode({
          id: verificationCodeId,
          emailNormalized,
          purpose: 'SIGNUP',
        });

        const settled = await Promise.allSettled([
          authService.signup(
            {
              email,
              password: 'Pass1234',
              nickname: '동시가입',
              gender: 'M',
              campus: 'CHUNCHEON',
              collegeCode: 'CHUNCHEON_IT',
              birthYear: 2002,
              legalAcceptances: signupLegalDocumentIds,
            } as never,
            verificationGrant,
          ),
          authService.signup(
            {
              email,
              password: 'Pass1234',
              nickname: '동시가입',
              gender: 'M',
              campus: 'CHUNCHEON',
              collegeCode: 'CHUNCHEON_IT',
              birthYear: 2002,
              legalAcceptances: signupLegalDocumentIds,
            } as never,
            verificationGrant,
          ),
        ]);

        const fulfilled = settled.map((result) => {
          expect(result.status).toBe('fulfilled');
          return (result as PromiseFulfilledResult<Awaited<ReturnType<AuthService['signup']>>>)
            .value;
        });
        const successes = fulfilled.filter((result) => Boolean(result.accessToken));
        const failures = fulfilled.filter((result) => !result.accessToken);

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);
        expect(
          [
            'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
            'AUTH_EMAIL_ALREADY_REGISTERED',
            'AUTH_NICKNAME_ALREADY_TAKEN',
          ].includes(failures[0]?.code ?? ''),
        ).toBe(true);

        await expect(expectUserAuthFootprint(emailNormalized)).resolves.toEqual({
          users: 1,
          displayIdentities: 1,
          academicIdentities: 1,
          authSessions: 1,
        });
        await expectVerificationConsumed(verificationCodeId, true);
      },
    );
  });

  describe('reset password transaction', () => {
    itWithQueryTrace(
      'reset password 성공 시 verification consume/password update/session revoke/login lock clear가 함께 반영된다',
      async () => {
        const email = 'reset-success@kangwon.ac.kr';
        const emailNormalized = normalizeEmail(email);
        const userId = 'reset-success-user';
        const oldPasswordHash = await hashPassword('OldPass1234');
        const verificationCodeId = 'reset-success-proof';
        const databaseNow = await prisma.getDatabaseNow();

        await seedUserWithDisplayIdentity({
          id: userId,
          email,
          nickname: '리셋성공',
          passwordHash: oldPasswordHash,
        });
        await prisma.authSession.createMany({
          data: [
            {
              id: 'reset-success-session-1',
              userId,
              expiresAt: new Date(databaseNow.getTime() + 60 * 60 * 1000),
            },
            {
              id: 'reset-success-session-2',
              userId,
              expiresAt: new Date(databaseNow.getTime() + 60 * 60 * 1000),
            },
          ],
        });
        const verificationGrant = await seedVerifiedCode({
          id: verificationCodeId,
          emailNormalized,
          purpose: 'RESET_PASSWORD',
          eligibleUserId: userId,
        });
        await prisma.loginAttempt.create({
          data: {
            id: 'reset-success-login-attempt',
            emailNormalized,
            failureCount: 5,
            lastFailedAt: databaseNow,
            lockedUntil: new Date(databaseNow.getTime() + 5 * 60 * 1_000),
          },
        });

        await expect(authService.resetPassword(verificationGrant, 'NewPass1234')).resolves.toEqual({
          success: true,
        });

        const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        await expect(verifyPasswordHash(updatedUser.passwordHash, 'NewPass1234')).resolves.toBe(
          true,
        );
        await expectVerificationConsumed(verificationCodeId, true);
        await expect(
          prisma.authSession.count({
            where: { userId, revokedAt: null },
          }),
        ).resolves.toBe(0);
        await expect(prisma.loginAttempt.count({ where: { emailNormalized } })).resolves.toBe(0);
        await expect(
          prisma.authSecurityEvent.count({
            where: {
              targetUserId: userId,
              type: { in: ['PASSWORD_RESET_SUCCEEDED', 'SESSION_REVOKE_ALL'] },
            },
          }),
        ).resolves.toBe(2);
        await expect(
          prisma.authMailOutboxEvent.count({
            where: { targetUserId: userId, mailKind: 'PASSWORD_CHANGED' },
          }),
        ).resolves.toBe(1);
        await expect(authService.login(email, 'NewPass1234', false)).resolves.toMatchObject({
          success: true,
        });
      },
    );

    itWithQueryTrace(
      'transaction 내부 verification consume 실패 시 password와 session revoke가 rollback된다',
      async () => {
        const email = 'reset-consume-failure@kangwon.ac.kr';
        const emailNormalized = normalizeEmail(email);
        const userId = 'reset-consume-failure-user';
        const oldPasswordHash = await hashPassword('OldPass1234');
        const verificationCodeId = 'reset-consumed-proof';
        const databaseNow = await prisma.getDatabaseNow();

        await seedUserWithDisplayIdentity({
          id: userId,
          email,
          nickname: '리셋실패',
          passwordHash: oldPasswordHash,
        });
        await prisma.authSession.create({
          data: {
            id: 'reset-consume-failure-session',
            userId,
            expiresAt: new Date(databaseNow.getTime() + 60 * 60 * 1000),
          },
        });
        const verificationGrant = await seedVerifiedCode({
          id: verificationCodeId,
          emailNormalized,
          purpose: 'RESET_PASSWORD',
          eligibleUserId: userId,
          consumedAt: databaseNow,
        });
        await prisma.loginAttempt.create({
          data: {
            id: 'reset-consume-failure-login-attempt',
            emailNormalized,
            failureCount: 5,
            lastFailedAt: databaseNow,
            lockedUntil: new Date(databaseNow.getTime() + 5 * 60 * 1_000),
          },
        });

        await expect(
          resetPasswordWithOwner(
            {
              prisma,
              verificationService: {
                resolveVerificationGrant() {
                  return Promise.resolve(
                    resolvedGrant({
                      id: verificationCodeId,
                      emailNormalized,
                      purpose: 'RESET_PASSWORD',
                      eligibleUserId: userId,
                      verificationGrant,
                    }),
                  );
                },
                matchesVerificationGrantSubject: verificationGrantSubjectMatches,
              },
              loginAttemptService: {
                async clearFailuresInTransaction(
                  tx: Pick<Prisma.TransactionClient, 'loginAttempt'>,
                  normalizedEmail: string,
                ) {
                  await tx.loginAttempt.deleteMany({
                    where: { emailNormalized: normalizedEmail },
                  });
                },
              },
              securityEvents: authSecurityEventService,
              mailOutboxWriter: authMailOutboxWriter,
            },
            verificationGrant,
            'NewPass1234',
          ),
        ).resolves.toMatchObject({
          success: false,
          code: 'AUTH_RESET_RESTART_REQUIRED',
        });

        await expect(
          prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        ).resolves.toMatchObject({
          passwordHash: oldPasswordHash,
        });
        await expect(
          prisma.authSession.findUniqueOrThrow({
            where: { id: 'reset-consume-failure-session' },
          }),
        ).resolves.toMatchObject({
          revokedAt: null,
        });
        await expect(prisma.loginAttempt.count({ where: { emailNormalized } })).resolves.toBe(1);
      },
    );

    itWithQueryTrace(
      '보안 알림 outbox append가 실패하면 consume/password/session/audit가 함께 rollback된다',
      async () => {
        const email = 'reset-post-update-rollback@kangwon.ac.kr';
        const emailNormalized = normalizeEmail(email);
        const userId = 'reset-post-update-rollback-user';
        const oldPasswordHash = await hashPassword('OldPass1234');
        const verificationCodeId = 'reset-post-update-rollback-proof';
        const databaseNow = await prisma.getDatabaseNow();

        await seedUserWithDisplayIdentity({
          id: userId,
          email,
          nickname: '리셋롤백',
          passwordHash: oldPasswordHash,
        });
        await prisma.authSession.create({
          data: {
            id: 'reset-post-update-rollback-session',
            userId,
            expiresAt: new Date(databaseNow.getTime() + 60 * 60 * 1000),
          },
        });
        const verificationGrant = await seedVerifiedCode({
          id: verificationCodeId,
          emailNormalized,
          purpose: 'RESET_PASSWORD',
          eligibleUserId: userId,
        });

        await expect(
          resetPasswordWithOwner(
            {
              prisma,
              verificationService: {
                resolveVerificationGrant() {
                  return Promise.resolve(
                    resolvedGrant({
                      id: verificationCodeId,
                      emailNormalized,
                      purpose: 'RESET_PASSWORD',
                      eligibleUserId: userId,
                      verificationGrant,
                    }),
                  );
                },
                matchesVerificationGrantSubject: verificationGrantSubjectMatches,
              },
              loginAttemptService: {
                async clearFailuresInTransaction(
                  tx: Pick<Prisma.TransactionClient, 'loginAttempt'>,
                  normalizedEmail: string,
                ) {
                  await tx.loginAttempt.deleteMany({
                    where: { emailNormalized: normalizedEmail },
                  });
                },
              },
              securityEvents: authSecurityEventService,
              mailOutboxWriter: {
                appendPasswordChanged() {
                  throw new Error('[integration-test] force outbox append failure');
                },
              },
            },
            verificationGrant,
            'NewPass1234',
          ),
        ).rejects.toThrow('[integration-test] force outbox append failure');

        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        expect(user.passwordHash).toBe(oldPasswordHash);
        await expectVerificationConsumed(verificationCodeId, false);
        await expect(
          prisma.authSession.findUniqueOrThrow({
            where: { id: 'reset-post-update-rollback-session' },
          }),
        ).resolves.toMatchObject({ revokedAt: null });
        await expect(
          prisma.authSecurityEvent.count({
            where: {
              targetUserId: userId,
              type: { in: ['PASSWORD_RESET_SUCCEEDED', 'SESSION_REVOKE_ALL'] },
            },
          }),
        ).resolves.toBe(0);
        await expect(
          prisma.authMailOutboxEvent.count({
            where: { targetUserId: userId, mailKind: 'PASSWORD_CHANGED' },
          }),
        ).resolves.toBe(0);
      },
    );

    itWithQueryTrace(
      'expired verified reset proof는 consume/password/session 변경 없이 restart required로 처리된다',
      async () => {
        const email = 'reset-expired-proof@kangwon.ac.kr';
        const emailNormalized = normalizeEmail(email);
        const userId = 'reset-expired-proof-user';
        const oldPasswordHash = await hashPassword('OldPass1234');
        const verificationCodeId = 'reset-expired-proof-code';
        const databaseNow = await prisma.getDatabaseNow();

        await seedUserWithDisplayIdentity({
          id: userId,
          email,
          nickname: '만료리셋',
          passwordHash: oldPasswordHash,
        });
        await prisma.authSession.create({
          data: {
            id: 'reset-expired-proof-session',
            userId,
            expiresAt: new Date(databaseNow.getTime() + 60 * 60 * 1000),
          },
        });
        const verificationGrant = `v1.${verificationCodeId}.${'e'.repeat(43)}`;
        await prisma.verificationCode.create({
          data: {
            id: verificationCodeId,
            subjectKey: toSubjectKey(emailNormalized),
            purpose: 'RESET_PASSWORD',
            codeHash: 'hmac-sha256:expired-proof',
            issuedAt: new Date(databaseNow.getTime() - 20 * 60 * 1000),
            codeExpiresAt: new Date(databaseNow.getTime() - 1000),
            verifiedAt: new Date(databaseNow.getTime() - 10 * 60 * 1000),
            grantTokenHash: hashVerificationGrant(verificationGrant),
            grantExpiresAt: new Date(databaseNow.getTime() - 1000),
            eligibleUserId: userId,
          },
        });

        await expect(
          resetPasswordWithOwner(
            {
              prisma,
              verificationService: {
                resolveVerificationGrant() {
                  return Promise.resolve(
                    resolvedGrant({
                      id: verificationCodeId,
                      emailNormalized,
                      purpose: 'RESET_PASSWORD',
                      eligibleUserId: userId,
                      verificationGrant,
                    }),
                  );
                },
                matchesVerificationGrantSubject: verificationGrantSubjectMatches,
              },
              loginAttemptService: {
                async clearFailuresInTransaction(
                  tx: Pick<Prisma.TransactionClient, 'loginAttempt'>,
                  normalizedEmail: string,
                ) {
                  await tx.loginAttempt.deleteMany({
                    where: { emailNormalized: normalizedEmail },
                  });
                },
              },
              securityEvents: authSecurityEventService,
              mailOutboxWriter: authMailOutboxWriter,
            },
            verificationGrant,
            'NewPass1234',
          ),
        ).resolves.toMatchObject({
          success: false,
          code: 'AUTH_RESET_RESTART_REQUIRED',
        });

        await expect(
          prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        ).resolves.toMatchObject({
          passwordHash: oldPasswordHash,
        });
        await expectVerificationConsumed(verificationCodeId, false);
        await expect(
          prisma.authSession.findUniqueOrThrow({ where: { id: 'reset-expired-proof-session' } }),
        ).resolves.toMatchObject({ revokedAt: null });
      },
    );

    itWithQueryTrace(
      '같은 reset code를 동시에 사용하면 성공은 최대 1개이고 성공 transaction만 session을 revoke한다',
      async () => {
        const email = 'reset-code-race@kangwon.ac.kr';
        const emailNormalized = normalizeEmail(email);
        const userId = 'reset-code-race-user';
        const oldPasswordHash = await hashPassword('OldPass1234');
        const verificationCodeId = 'reset-code-race-proof';
        const databaseNow = await prisma.getDatabaseNow();

        await seedUserWithDisplayIdentity({
          id: userId,
          email,
          nickname: '리셋경쟁',
          passwordHash: oldPasswordHash,
        });
        await prisma.authSession.create({
          data: {
            id: 'reset-code-race-session',
            userId,
            expiresAt: new Date(databaseNow.getTime() + 60 * 60 * 1000),
          },
        });
        const verificationGrant = await seedVerifiedCode({
          id: verificationCodeId,
          emailNormalized,
          purpose: 'RESET_PASSWORD',
          eligibleUserId: userId,
        });

        const settled = await Promise.allSettled([
          authService.resetPassword(verificationGrant, 'NewPass1234'),
          authService.resetPassword(verificationGrant, 'OtherPass1234'),
        ]);
        const fulfilled = settled.map((result) => {
          expect(result.status).toBe('fulfilled');
          return (
            result as PromiseFulfilledResult<Awaited<ReturnType<AuthService['resetPassword']>>>
          ).value;
        });

        expect(fulfilled.filter((result) => result.success)).toHaveLength(1);
        expect(
          fulfilled.filter((result) => result.code === 'AUTH_RESET_RESTART_REQUIRED'),
        ).toHaveLength(1);
        await expectVerificationConsumed(verificationCodeId, true);
        await expect(
          prisma.authSession.count({
            where: { userId, revokedAt: null },
          }),
        ).resolves.toBe(0);
      },
    );
  });

  describe('nickname update race', () => {
    itWithQueryTrace(
      '서로 다른 두 사용자가 같은 nickname으로 update하면 DB unique/P2002 mapping으로 성공은 최대 1개다',
      async () => {
        const barrier = createBarrier(2);
        const owner = createNicknameUpdateOwner(barrier);
        await seedUserWithDisplayIdentity({
          id: 'nickname-race-user-a',
          email: 'nickname-race-a@kangwon.ac.kr',
          nickname: '기존가',
        });
        await seedUserWithDisplayIdentity({
          id: 'nickname-race-user-b',
          email: 'nickname-race-b@kangwon.ac.kr',
          nickname: '기존나',
        });

        const first = owner.updateCurrentUser(authContext('nickname-race-user-a'), {
          displayIdentity: { nickname: '공통닉' },
        });
        const second = owner.updateCurrentUser(authContext('nickname-race-user-b'), {
          displayIdentity: { nickname: '공통닉' },
        });
        await barrier.waitUntilAllBlocked();
        barrier.release();

        const settled = await Promise.allSettled([first, second]);
        const successes = settled.filter((result) => result.status === 'fulfilled');
        const failures = settled.filter((result) => result.status === 'rejected');

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);
        expect(getHttpExceptionCode((failures[0] as PromiseRejectedResult).reason)).toBe(
          'NICKNAME_ALREADY_TAKEN',
        );
        await expect(
          prisma.userDisplayIdentity.count({
            where: { nicknameNormalized: normalizeNickname('공통닉') },
          }),
        ).resolves.toBe(1);
      },
    );

    itWithQueryTrace(
      '같은 사용자가 동시에 서로 다른 nickname으로 update하면 optimistic condition으로 성공은 최대 1개다',
      async () => {
        const barrier = createBarrier(2);
        const owner = createNicknameUpdateOwner(barrier);
        await seedUserWithDisplayIdentity({
          id: 'same-user-nickname-race',
          email: 'same-user-nickname-race@kangwon.ac.kr',
          nickname: '기존닉',
        });

        const first = owner.updateCurrentUser(authContext('same-user-nickname-race'), {
          displayIdentity: { nickname: '새닉가' },
        });
        const second = owner.updateCurrentUser(authContext('same-user-nickname-race'), {
          displayIdentity: { nickname: '새닉나' },
        });
        await barrier.waitUntilAllBlocked();
        barrier.release();

        const settled = await Promise.allSettled([first, second]);
        const successes = settled.filter((result) => result.status === 'fulfilled');
        const failures = settled.filter((result) => result.status === 'rejected');

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);
        expect(getHttpExceptionCode((failures[0] as PromiseRejectedResult).reason)).toBe(
          'NICKNAME_COOLDOWN_ACTIVE',
        );

        const displayIdentity = await prisma.userDisplayIdentity.findUniqueOrThrow({
          where: { userId: 'same-user-nickname-race' },
        });
        expect(['새닉가', '새닉나']).toContain(displayIdentity.nickname);
        expect(displayIdentity.nicknameChangedAt).not.toBeNull();
      },
    );
  });

  describe('onboarding dismiss idempotency', () => {
    itWithQueryTrace(
      'first dismiss는 row를 만들고 current-user onboarding dismissed state를 true로 반환한다',
      async () => {
        await seedUserWithDisplayIdentity({
          id: 'onboarding-first-dismiss-user',
          email: 'onboarding-first-dismiss@kangwon.ac.kr',
          nickname: '첫온보딩',
        });

        const authUser = authContext('onboarding-first-dismiss-user');
        const before = await usersService.getCurrentUser(authUser);
        expect(findServiceIntroNotice(before)).toMatchObject({
          noticeKey: SERVICE_INTRO_NOTICE_KEY,
          dismissed: false,
          dismissedAt: null,
        });

        const after = await usersService.dismissCurrentUserOnboardingNotice(authUser, {
          noticeKey: SERVICE_INTRO_NOTICE_KEY,
        });

        const dismissedNotice = findServiceIntroNotice(after);
        expect(dismissedNotice).toMatchObject({
          noticeKey: SERVICE_INTRO_NOTICE_KEY,
          dismissed: true,
        });
        expect(dismissedNotice?.dismissedAt).toEqual(expect.any(String));
        await expect(
          prisma.userDismissedNotice.count({
            where: {
              userId: 'onboarding-first-dismiss-user',
              noticeKey: SERVICE_INTRO_NOTICE_KEY,
            },
          }),
        ).resolves.toBe(1);
      },
    );

    itWithQueryTrace(
      '같은 user/key dismiss를 2회 실행해도 UserDismissedNotice row는 1개다',
      async () => {
        await seedUserWithDisplayIdentity({
          id: 'onboarding-idempotent-user',
          email: 'onboarding-idempotent@kangwon.ac.kr',
          nickname: '온보딩',
        });

        const authUser = authContext('onboarding-idempotent-user');
        const settled = await Promise.allSettled([
          usersService.dismissCurrentUserOnboardingNotice(authUser, {
            noticeKey: SERVICE_INTRO_NOTICE_KEY,
          }),
          usersService.dismissCurrentUserOnboardingNotice(authUser, {
            noticeKey: SERVICE_INTRO_NOTICE_KEY,
          }),
        ]);

        expect(settled.every((result) => result.status === 'fulfilled')).toBe(true);
        await expect(
          prisma.userDismissedNotice.count({
            where: {
              userId: 'onboarding-idempotent-user',
              noticeKey: SERVICE_INTRO_NOTICE_KEY,
            },
          }),
        ).resolves.toBe(1);
      },
    );

    itWithQueryTrace(
      'onboarding dismiss는 season participant/profile 존재 여부와 독립적으로 동작한다',
      async () => {
        await seedBaseSeasonFixtures(prisma);
        await seedUserWithDisplayIdentity({
          id: 'onboarding-season-profile-user',
          email: 'onboarding-season-profile@kangwon.ac.kr',
          nickname: '시즌온보딩',
        });
        await seedRegisteredSeasonProfileForUser('onboarding-season-profile-user', '시즌온보딩');

        const authUser = authContext('onboarding-season-profile-user');
        const before = await usersService.getCurrentUser(authUser);
        expect(before.seasonProfile.profileExists).toBe(true);
        expect(findServiceIntroNotice(before)).toMatchObject({
          dismissed: false,
          dismissedAt: null,
        });

        const after = await usersService.dismissCurrentUserOnboardingNotice(authUser, {
          noticeKey: SERVICE_INTRO_NOTICE_KEY,
        });

        expect(after.seasonProfile.profileExists).toBe(true);
        const afterNotice = findServiceIntroNotice(after);
        expect(afterNotice?.dismissed).toBe(true);
        expect(afterNotice?.dismissedAt).toEqual(expect.any(String));
      },
    );

    itWithQueryTrace(
      'unsupported noticeKey는 UserDismissedNotice row를 만들지 않는다',
      async () => {
        await seedUserWithDisplayIdentity({
          id: 'onboarding-unsupported-user',
          email: 'onboarding-unsupported@kangwon.ac.kr',
          nickname: '온보딩키',
        });

        let unsupportedError: unknown = null;
        try {
          await usersService.dismissCurrentUserOnboardingNotice(
            authContext('onboarding-unsupported-user'),
            {
              noticeKey: 'unsupported-notice',
            } as never,
          );
        } catch (error) {
          unsupportedError = error;
        }

        expect(getHttpExceptionCode(unsupportedError)).toBe('INVALID_USER_PATCH');
        await expect(
          prisma.userDismissedNotice.count({
            where: { userId: 'onboarding-unsupported-user' },
          }),
        ).resolves.toBe(0);
      },
    );
  });

  function createNicknameUpdateOwner(barrier: ReturnType<typeof createBarrier>) {
    const nicknamePolicy = new DisplayIdentityNicknamePolicyService(
      {
        async validateNicknamePolicy() {
          await barrier.block();
          return null;
        },
      } as never,
      new DisplayIdentityRepository(prisma),
    );

    return createUserUpdateOwner({
      prisma,
      seasonsService,
      nicknamePolicy,
      currentUserViewService: {
        buildCurrentUserResponse(user: Parameters<typeof buildCurrentUserResponse>[0]) {
          return buildCurrentUserResponse(user);
        },
      } as unknown as CurrentUserViewService,
    });
  }

  async function seedVerifiedCode(input: {
    id: string;
    emailNormalized: string;
    purpose: 'SIGNUP' | 'RESET_PASSWORD';
    eligibleUserId?: string | null;
    consumedAt?: Date | null;
  }) {
    const databaseNow = await prisma.getDatabaseNow();
    const verificationGrant = `v1.${input.id}.${'g'.repeat(43)}`;
    await prisma.verificationCode.create({
      data: {
        id: input.id,
        subjectKey: toSubjectKey(input.emailNormalized),
        purpose: input.purpose,
        codeHash: `hmac-sha256:${input.id}`,
        issuedAt: databaseNow,
        codeExpiresAt: new Date(databaseNow.getTime() + 10 * 60 * 1000),
        verifiedAt: databaseNow,
        grantTokenHash: hashVerificationGrant(verificationGrant),
        grantExpiresAt: new Date(databaseNow.getTime() + 15 * 60 * 1000),
        eligibleUserId: input.eligibleUserId ?? null,
        consumedAt: input.consumedAt ?? null,
      },
    });
    return verificationGrant;
  }

  function resolvedGrant(input: {
    id: string;
    emailNormalized: string;
    purpose: 'SIGNUP' | 'RESET_PASSWORD';
    verificationGrant: string;
    eligibleUserId?: string | null;
  }) {
    return {
      id: input.id,
      subjectKey: toSubjectKey(input.emailNormalized),
      purpose: input.purpose,
      eligibleUserId: input.eligibleUserId ?? null,
      tokenHash: hashVerificationGrant(input.verificationGrant),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };
  }

  function verificationGrantSubjectMatches(
    grant: { subjectKey: string },
    emailNormalized: string,
  ): boolean {
    return grant.subjectKey === toSubjectKey(emailNormalized);
  }

  function toSubjectKey(emailNormalized: string): string {
    return hashAuthPersistenceDimension(
      'subject',
      emailNormalized,
      DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET,
    );
  }

  async function seedUserWithDisplayIdentity(input: {
    id: string;
    email: string;
    nickname: string;
    passwordHash?: string;
    nicknameChangedAt?: Date | null;
    withAcademicIdentity?: boolean;
  }) {
    const databaseNow = await prisma.getDatabaseNow();
    if (input.withAcademicIdentity !== false) {
      await ensureAcademicIdentityReferenceData();
    }

    await prisma.user.create({
      data: {
        id: input.id,
        email: input.email,
        emailNormalized: normalizeEmail(input.email),
        passwordHash: input.passwordHash ?? 'integration-password-hash',
        gender: 'M',
        campus: 'CHUNCHEON',
        emailVerifiedAt: databaseNow,
        displayIdentity: {
          create: {
            nickname: input.nickname,
            nicknameNormalized: normalizeNickname(input.nickname),
            nicknameChangedAt: input.nicknameChangedAt ?? null,
          },
        },
        ...(input.withAcademicIdentity === false
          ? {}
          : {
              academicIdentity: {
                create: {
                  collegeCode: 'CHUNCHEON_IT',
                  birthYear: 2002,
                },
              },
              academicChangeAllowance: {
                create: {
                  academicYear: databaseNow.getUTCFullYear(),
                  collegeChangeRemaining: 1,
                  resetReason: 'INITIAL_CYCLE_ALLOWANCE',
                },
              },
            }),
      },
    });
  }

  async function seedRegisteredSeasonProfileForUser(userId: string, nickname: string) {
    const databaseNow = await prisma.getDatabaseNow();
    await prisma.seasonParticipant.create({
      data: {
        id: `${userId}-participant`,
        seasonId: 'season-integration',
        userId,
        participationIntent: 'REGISTERED',
        registeredAt: databaseNow,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
        joinedAt: databaseNow,
        activatedAt: databaseNow,
        profile: {
          create: {
            nicknameSnapshot: nickname,
            nicknameNormalizedSnapshot: normalizeNickname(nickname),
            ...toCompleteLifestyleColumnData(DEFAULT_LIFESTYLE),
            intro: `${nickname} 소개`,
          },
        },
      },
    });
  }

  async function expectUserAuthFootprint(emailNormalized: string) {
    const academicIdentityDelegate = (
      prisma as unknown as {
        userAcademicIdentity?: {
          count(args: {
            where: {
              user: {
                emailNormalized: string;
              };
            };
          }): Promise<number>;
        };
      }
    ).userAcademicIdentity;
    const [users, displayIdentities, academicIdentities, authSessions] = await Promise.all([
      prisma.user.count({ where: { emailNormalized } }),
      prisma.userDisplayIdentity.count({ where: { user: { emailNormalized } } }),
      academicIdentityDelegate
        ? academicIdentityDelegate.count({ where: { user: { emailNormalized } } })
        : Promise.resolve(0),
      prisma.authSession.count({ where: { user: { emailNormalized } } }),
    ]);

    return { users, displayIdentities, academicIdentities, authSessions };
  }

  async function ensureAcademicIdentityReferenceData() {
    await prisma.campusMaster.upsert({
      where: { code: 'CHUNCHEON' },
      create: {
        code: 'CHUNCHEON',
        nameKo: '춘천캠퍼스',
        isOperated: true,
        sortOrder: 1,
      },
      update: {
        isOperated: true,
      },
    });
    await prisma.collegeMaster.upsert({
      where: { code: 'CHUNCHEON_IT' },
      create: {
        code: 'CHUNCHEON_IT',
        campusCode: 'CHUNCHEON',
        nameKo: 'IT대',
        sortOrder: 1,
      },
      update: {
        campusCode: 'CHUNCHEON',
        nameKo: 'IT대',
        sortOrder: 1,
        isActive: true,
      },
    });
  }

  async function seedAcademicIdentityReferenceData() {
    await seedBaseSeasonFixtures(prisma);
    const databaseNow = await prisma.getDatabaseNow();
    const effectiveAt = new Date(databaseNow.getTime() - 60_000);
    await prisma.legalDocumentVersion.createMany({
      data: [
        {
          id: signupLegalDocumentIds.termsVersionId,
          kind: 'TERMS_OF_SERVICE',
          version: 'auth-users-transaction-terms',
          title: '인증 트랜잭션 테스트 이용약관',
          summaryItems: [],
          sections: [],
          publishedAt: effectiveAt,
          effectiveAt,
        },
        {
          id: signupLegalDocumentIds.privacyPolicyVersionIdShown,
          kind: 'PRIVACY_POLICY',
          version: 'auth-users-transaction-privacy',
          title: '인증 트랜잭션 테스트 개인정보 처리방침',
          summaryItems: [],
          sections: [],
          publishedAt: effectiveAt,
          effectiveAt,
        },
        {
          id: signupLegalDocumentIds.personalDataConsentVersionId,
          kind: 'PERSONAL_DATA_COLLECTION_USE_CONSENT',
          version: 'auth-users-transaction-personal-data-consent',
          title: '인증 트랜잭션 테스트 개인정보 수집·이용 동의',
          summaryItems: [],
          sections: [],
          publishedAt: effectiveAt,
          effectiveAt,
        },
        {
          id: signupLegalDocumentIds.ageNoticeVersionId,
          kind: 'AGE_14_OR_ABOVE_NOTICE',
          version: 'auth-users-transaction-age-notice',
          title: '인증 트랜잭션 테스트 연령 확인',
          summaryItems: [],
          sections: [],
          publishedAt: effectiveAt,
          effectiveAt,
        },
      ],
    });
    await prisma.collegeMaster.upsert({
      where: { code: 'CHUNCHEON_IT' },
      create: {
        code: 'CHUNCHEON_IT',
        campusCode: 'CHUNCHEON',
        nameKo: 'IT대',
        sortOrder: 1,
      },
      update: {
        campusCode: 'CHUNCHEON',
        nameKo: 'IT대',
        sortOrder: 1,
        isActive: true,
      },
    });
  }

  async function expectVerificationConsumed(verificationCodeId: string, consumed: boolean) {
    const row = await prisma.verificationCode.findUniqueOrThrow({
      where: { id: verificationCodeId },
    });
    expect(row.consumedAt === null).toBe(!consumed);
  }

  function findServiceIntroNotice(response: CurrentUserResponse) {
    return response.onboarding.dismissedNotices.find(
      (notice) => notice.noticeKey === SERVICE_INTRO_NOTICE_KEY,
    );
  }
});

function createGate() {
  let blocked = false;
  let resolveBlocked: () => void = () => undefined;
  let releaseBlocked: () => void = () => undefined;
  const blockedPromise = new Promise<void>((resolve) => {
    resolveBlocked = resolve;
  });
  const releasePromise = new Promise<void>((resolve) => {
    releaseBlocked = resolve;
  });

  return {
    async block() {
      if (!blocked) {
        blocked = true;
        resolveBlocked();
      }
      await releasePromise;
    },
    waitUntilBlocked() {
      return blockedPromise;
    },
    release() {
      releaseBlocked();
    },
  };
}

function createBarrier(parties: number) {
  let blockedCount = 0;
  let resolveAllBlocked: () => void = () => undefined;
  let releaseBlocked: () => void = () => undefined;
  const allBlockedPromise = new Promise<void>((resolve) => {
    resolveAllBlocked = resolve;
  });
  const releasePromise = new Promise<void>((resolve) => {
    releaseBlocked = resolve;
  });

  return {
    async block() {
      blockedCount += 1;
      if (blockedCount === parties) {
        resolveAllBlocked();
      }
      await releasePromise;
    },
    waitUntilAllBlocked() {
      return allBlockedPromise;
    },
    release() {
      releaseBlocked();
    },
  };
}

function authContext(userId: string): AuthContext {
  return {
    id: userId,
    gender: 'M',
    campus: 'CHUNCHEON',
  };
}

function buildCurrentUserResponse(user: {
  id: string;
  email: string;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  displayIdentity: {
    userId: string;
    nickname: string;
    nicknameChangedAt: Date | null;
  } | null;
}): CurrentUserResponse {
  if (!user.displayIdentity) {
    throw new Error('[integration-test] display identity is required');
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      nickname: user.displayIdentity.nickname,
      gender: user.gender,
      campus: user.campus,
    },
    displayIdentity: {
      userId: user.displayIdentity.userId,
      nickname: user.displayIdentity.nickname,
      nicknameSource: 'USER_DISPLAY_IDENTITY',
      nicknameChangedAt: user.displayIdentity.nicknameChangedAt?.toISOString() ?? null,
    },
    academicIdentity: {
      collegeCode: 'CHUNCHEON_IT',
      birthYear: 2002,
    },
    seasonProfile: {
      hasCurrentSeason: false,
      hasParticipantRow: false,
      intent: null,
      registered: false,
      profileExists: false,
      profileState: 'NONE',
      completion: {
        profileCompletionRequired: false,
        dormitorySelectionRequired: false,
        registrationUnavailable: true,
        registrationUnavailableReasons: ['NO_CURRENT_SEASON'],
      },
      draftWritable: false,
      canSelectDormitory: false,
      canFinalizeRegistration: false,
    },
    selection: {
      state: 'NOT_SELECTED',
      dormitoryId: null,
      source: 'SEASON_PARTICIPANT',
    },
    match: {
      hasActiveMatch: false,
      activeMatch: null,
    },
    capabilities: {
      canEnterRoommateSearch: false,
      canCreateOrUpdateSeasonProfileDraft: false,
      canSelectDormitory: false,
      canFinalizeSeasonRegistration: false,
      canEditDisplayIdentity: true,
      displayIdentityEditUnavailableReasons: [],
      canEditAcademicIdentity: true,
      academicIdentityEditUnavailableReasons: [],
      canBookmark: false,
      canRequestMatch: false,
      canStartChat: false,
    },
    onboarding: {
      dismissedNotices: [
        {
          noticeKey: SERVICE_INTRO_NOTICE_KEY,
          dismissed: false,
          dismissedAt: null,
        },
      ],
    },
    serviceState: {
      campusOperated: false,
      seasonState: null,
    },
  };
}

function getHttpExceptionCode(error: unknown) {
  if (!(error instanceof HttpException)) {
    return null;
  }

  const response = error.getResponse();
  if (typeof response === 'object' && response !== null && 'code' in response) {
    const code = (response as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }

  return null;
}

function getHttpExceptionBody(error: unknown) {
  if (!(error instanceof HttpException)) {
    return null;
  }

  const response = error.getResponse();
  return typeof response === 'object' && response !== null ? response : null;
}
