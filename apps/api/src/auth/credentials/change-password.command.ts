import type { ChangePasswordResponse } from '@repo/shared/auth/response';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type {
  AuthenticatedUserContext,
  AuthSessionService,
} from '../sessions/auth-session.service.js';
import { authFailures } from '../errors/auth-failures.js';
import { hashPassword, verifyPasswordHash } from './password-hashing/password-hash.js';
import { isPasswordHashCapacityUnavailableError } from './password-hashing/password-hash-admission.service.js';
import type { AuthSecurityEventService } from '../security-events/auth-security-event.service.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import type { AuthMailOutboxWriter } from '../mail/auth-mail-outbox-writer.service.js';
import type { ChangePasswordAdmissionService } from './change-password-admission.service.js';
import type { AuthCredentialMetricsService } from './auth-credential-metrics.service.js';
import type { AuthPasswordPolicyService } from './password-policy/auth-password-policy.service.js';

const CHANGE_PASSWORD_SESSION_UNAVAILABLE =
  '[AuthChangePasswordOwner] current authenticated session unavailable';
const CHANGE_PASSWORD_OWNER_STALE = '[AuthChangePasswordOwner] observed password owner is stale';

interface AuthChangePasswordOwnerDeps {
  prisma: PrismaService;
  sessionService: Pick<AuthSessionService, 'prepareSessionIssue' | 'appendPreparedSession'>;
  securityEvents: Pick<AuthSecurityEventService, 'recordInTransaction'>;
  mailOutboxWriter: Pick<AuthMailOutboxWriter, 'appendPasswordChanged'>;
  admission: Pick<ChangePasswordAdmissionService, 'consume'>;
  passwordPolicy: Pick<AuthPasswordPolicyService, 'evaluateNewPassword'>;
  metrics?: Pick<
    AuthCredentialMetricsService,
    'recordPasswordPolicyRejected' | 'recordSensitiveMutation'
  >;
}

export async function changePassword(
  deps: AuthChangePasswordOwnerDeps,
  authUser: AuthenticatedUserContext,
  currentPassword: string,
  newPassword: string,
  requestContext: AuthRequestContext = {},
): Promise<ChangePasswordResponse> {
  if (!authUser.sessionId) {
    deps.metrics?.recordSensitiveMutation('change_password', 'session_required');
    return authFailures.reauthenticationRequired();
  }

  const retryAfterSeconds = await deps.admission.consume(authUser.id, authUser.sessionId);
  if (retryAfterSeconds) {
    return authFailures.changePasswordThrottled(retryAfterSeconds);
  }

  const user = await deps.prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      deletedAt: true,
      displayIdentity: {
        select: { nickname: true },
      },
    },
  });

  if (!user || user.deletedAt) {
    deps.metrics?.recordSensitiveMutation('change_password', 'rejected');
    return authFailures.currentPasswordInvalid();
  }

  let currentPasswordMatches: boolean;
  try {
    currentPasswordMatches = await verifyPasswordHash(
      user.passwordHash,
      currentPassword,
      'change_verify',
    );
  } catch (error) {
    if (isPasswordHashCapacityUnavailableError(error)) {
      return authFailures.passwordHashCapacityUnavailable(error.retryAfterSeconds);
    }
    throw error;
  }
  if (!currentPasswordMatches) {
    deps.metrics?.recordSensitiveMutation('change_password', 'rejected');
    return authFailures.currentPasswordInvalid();
  }

  const passwordDecision = deps.passwordPolicy.evaluateNewPassword(newPassword, {
    email: user.email,
    nickname: user.displayIdentity?.nickname,
  });
  if (!passwordDecision.ok) {
    deps.metrics?.recordPasswordPolicyRejected('change_password', passwordDecision.reason);
    deps.metrics?.recordSensitiveMutation('change_password', 'rejected');
    return authFailures.passwordPolicyViolation(passwordDecision.message, 'newPassword');
  }

  let samePassword: boolean;
  try {
    samePassword = await verifyPasswordHash(user.passwordHash, newPassword, 'change_verify');
  } catch (error) {
    if (isPasswordHashCapacityUnavailableError(error)) {
      return authFailures.passwordHashCapacityUnavailable(error.retryAfterSeconds);
    }
    throw error;
  }
  if (samePassword) {
    deps.metrics?.recordSensitiveMutation('change_password', 'rejected');
    return authFailures.samePasswordNotAllowed();
  }

  const databaseNow = await deps.prisma.getDatabaseNow();
  const observedSession = await deps.prisma.authSession.findFirst({
    where: {
      id: authUser.sessionId,
      userId: user.id,
      revokedAt: null,
      expiresAt: { gt: databaseNow },
    },
    select: { rememberMe: true },
  });
  if (!observedSession) {
    deps.metrics?.recordSensitiveMutation('change_password', 'session_required');
    return authFailures.reauthenticationRequired();
  }

  let passwordHash: string;
  try {
    passwordHash = await hashPassword(newPassword, 'change_hash');
  } catch (error) {
    if (isPasswordHashCapacityUnavailableError(error)) {
      return authFailures.passwordHashCapacityUnavailable(error.retryAfterSeconds);
    }
    throw error;
  }
  const preparedSession = await deps.sessionService.prepareSessionIssue(
    user.id,
    user.email,
    observedSession.rememberMe,
  );

  try {
    const commit = await deps.prisma.runSerializableTransaction(async (tx) => {
      const currentSession = await tx.authSession.findFirst({
        where: {
          id: authUser.sessionId,
          userId: user.id,
          rememberMe: observedSession.rememberMe,
          revokedAt: null,
          expiresAt: {
            gt: databaseNow,
          },
        },
        select: { id: true },
      });

      if (!currentSession) {
        throw new Error(CHANGE_PASSWORD_SESSION_UNAVAILABLE);
      }

      const passwordUpdate = await tx.user.updateMany({
        where: {
          id: user.id,
          passwordHash: user.passwordHash,
          deletedAt: null,
        },
        data: { passwordHash },
      });
      if (passwordUpdate.count !== 1) {
        throw new Error(CHANGE_PASSWORD_OWNER_STALE);
      }

      const revokeResult = await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: databaseNow },
      });
      try {
        await deps.sessionService.appendPreparedSession(tx, preparedSession);
      } catch (error) {
        deps.metrics?.recordSensitiveMutation('change_password', 'replacement_session_failed');
        throw error;
      }
      try {
        await deps.mailOutboxWriter.appendPasswordChanged(tx, {
          targetUserId: user.id,
          email: user.email,
          now: databaseNow,
        });
      } catch (error) {
        deps.metrics?.recordSensitiveMutation('change_password', 'outbox_append_failed');
        throw error;
      }
      try {
        await deps.securityEvents.recordInTransaction(tx, {
          type: 'SESSION_REVOKE_ALL',
          severity: 'INFO',
          actorUserId: user.id,
          targetUserId: user.id,
          sessionId: authUser.sessionId,
          emailNormalized: user.email,
          requestIp: requestContext.requestIp,
          userAgent: requestContext.userAgent,
          metadata: {
            reason: 'change_password',
            revokedCount: revokeResult.count,
          },
        });
        await deps.securityEvents.recordInTransaction(tx, {
          type: 'CHANGE_PASSWORD_SUCCEEDED',
          severity: 'INFO',
          actorUserId: user.id,
          targetUserId: user.id,
          sessionId: preparedSession.result.sessionId,
          emailNormalized: user.email,
          requestIp: requestContext.requestIp,
          userAgent: requestContext.userAgent,
        });
      } catch (error) {
        deps.metrics?.recordSensitiveMutation('change_password', 'audit_append_failed');
        throw error;
      }

      return {
        rememberMe: observedSession.rememberMe,
        revokedSessionCount: revokeResult.count,
        replacementSessionId: preparedSession.result.sessionId,
      } as const;
    });

    deps.metrics?.recordSensitiveMutation('change_password', 'committed');
    return {
      success: true,
      accessToken: preparedSession.result.accessToken,
      renewalToken: preparedSession.result.renewalToken,
      rememberMe: commit.rememberMe,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      [CHANGE_PASSWORD_SESSION_UNAVAILABLE, CHANGE_PASSWORD_OWNER_STALE].includes(error.message)
    ) {
      deps.metrics?.recordSensitiveMutation('change_password', 'stale');
      return authFailures.reauthenticationRequired();
    }

    deps.metrics?.recordSensitiveMutation('change_password', 'failed');
    throw error;
  }
}
