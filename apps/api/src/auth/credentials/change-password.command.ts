import type { ChangePasswordResponse } from '@repo/shared/auth/response';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type {
  AuthenticatedUserContext,
  AuthSessionService,
} from '../sessions/auth-session.service.js';
import { authFailures } from '../errors/auth-failures.js';
import { hashPassword, verifyPasswordHash } from './password-hash.js';
import { validatePasswordPolicy } from '../domain/auth.utils.js';
import type { AuthSecurityEventService } from '../security-events/auth-security-event.service.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import type { AuthMailOutboxWriter } from '../mail/auth-mail-outbox-writer.service.js';
import type { ChangePasswordAdmissionService } from './change-password-admission.service.js';
import type { AuthFlowMetricsService } from '../operations/auth-flow-metrics.service.js';
import {
  AUTH_PASSWORD_RISK_REJECTION_MESSAGE,
  type AuthPasswordPolicyService,
} from './password-policy.service.js';

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
  flowMetrics?: Pick<AuthFlowMetricsService, 'recordSensitiveMutation'>;
}

export async function changePassword(
  deps: AuthChangePasswordOwnerDeps,
  authUser: AuthenticatedUserContext,
  currentPassword: string,
  newPassword: string,
  requestContext: AuthRequestContext = {},
): Promise<ChangePasswordResponse> {
  if (!authUser.sessionId) {
    deps.flowMetrics?.recordSensitiveMutation('change_password', 'session_required');
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
    deps.flowMetrics?.recordSensitiveMutation('change_password', 'rejected');
    return authFailures.currentPasswordInvalid();
  }

  const currentPasswordMatches = await verifyPasswordHash(user.passwordHash, currentPassword);
  if (!currentPasswordMatches) {
    deps.flowMetrics?.recordSensitiveMutation('change_password', 'rejected');
    return authFailures.currentPasswordInvalid();
  }

  const passwordError = validatePasswordPolicy(newPassword, user.email);
  if (passwordError) {
    deps.flowMetrics?.recordSensitiveMutation('change_password', 'rejected');
    return authFailures.passwordPolicyViolation(passwordError, 'newPassword');
  }

  const passwordRisk = deps.passwordPolicy.evaluateNewPassword(newPassword, {
    email: user.email,
    nickname: user.displayIdentity?.nickname,
  });
  if (!passwordRisk.ok) {
    deps.flowMetrics?.recordSensitiveMutation('change_password', 'rejected');
    return authFailures.passwordPolicyViolation(
      AUTH_PASSWORD_RISK_REJECTION_MESSAGE,
      'newPassword',
    );
  }

  const samePassword = await verifyPasswordHash(user.passwordHash, newPassword);
  if (samePassword) {
    deps.flowMetrics?.recordSensitiveMutation('change_password', 'rejected');
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
    deps.flowMetrics?.recordSensitiveMutation('change_password', 'session_required');
    return authFailures.reauthenticationRequired();
  }

  const passwordHash = await hashPassword(newPassword);
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
        deps.flowMetrics?.recordSensitiveMutation('change_password', 'replacement_session_failed');
        throw error;
      }
      try {
        await deps.mailOutboxWriter.appendPasswordChanged(tx, {
          targetUserId: user.id,
          email: user.email,
          now: databaseNow,
        });
      } catch (error) {
        deps.flowMetrics?.recordSensitiveMutation('change_password', 'outbox_append_failed');
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
        deps.flowMetrics?.recordSensitiveMutation('change_password', 'audit_append_failed');
        throw error;
      }

      return {
        rememberMe: observedSession.rememberMe,
        revokedSessionCount: revokeResult.count,
        replacementSessionId: preparedSession.result.sessionId,
      } as const;
    });

    deps.flowMetrics?.recordSensitiveMutation('change_password', 'committed');
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
      deps.flowMetrics?.recordSensitiveMutation('change_password', 'stale');
      return authFailures.reauthenticationRequired();
    }

    deps.flowMetrics?.recordSensitiveMutation('change_password', 'failed');
    throw error;
  }
}
