import type { GenericSuccessResult } from '../domain/auth.types.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { AuthVerificationService } from '../verification/auth-verification.service.js';
import { authFailures } from '../errors/auth-failures.js';
import { hashPassword, verifyPasswordHash } from './password-hashing/password-hash.js';
import { isPasswordHashCapacityUnavailableError } from './password-hashing/password-hash-admission.service.js';
import {
  acquireVerificationCodePurposeLock,
  consumeVerificationGrantOrThrow,
  RESET_VERIFICATION_GRANT_UNAVAILABLE,
} from '../verification/verification-grant-consumption.js';
import type { AuthSecurityEventService } from '../security-events/auth-security-event.service.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import type { AuthLoginAttemptService } from '../login-attempts/auth-login-attempt.service.js';
import type { AuthMailOutboxWriter } from '../mail/auth-mail-outbox-writer.service.js';
import type { AuthFlowMetricsService } from '../operations/auth-flow-metrics.service.js';
import type { AuthPasswordPolicyService } from './password-policy/auth-password-policy.service.js';

const RESET_PASSWORD_OWNER_STALE = 'RESET_PASSWORD_OWNER_STALE';

interface AuthResetPasswordOwnerDeps {
  prisma: PrismaService;
  verificationService: Pick<
    AuthVerificationService,
    'resolveVerificationGrant' | 'matchesVerificationGrantSubject'
  >;
  passwordPolicy: Pick<AuthPasswordPolicyService, 'evaluateNewPassword'>;
  loginAttemptService: Pick<AuthLoginAttemptService, 'clearFailuresInTransaction'>;
  securityEvents: Pick<AuthSecurityEventService, 'recordInTransaction'>;
  mailOutboxWriter: Pick<AuthMailOutboxWriter, 'appendPasswordChanged'>;
  flowMetrics?: Pick<AuthFlowMetricsService, 'recordPasswordPolicyRejected'>;
}

export async function resetPassword(
  deps: AuthResetPasswordOwnerDeps,
  verificationGrant: string | null,
  newPassword: string,
  requestContext: AuthRequestContext = {},
): Promise<GenericSuccessResult> {
  const resolvedGrant = await deps.verificationService.resolveVerificationGrant(
    verificationGrant,
    'RESET_PASSWORD',
  );
  if (!resolvedGrant?.eligibleUserId) {
    return authFailures.resetRestartRequired();
  }

  const user = await deps.prisma.user.findUnique({
    where: { id: resolvedGrant.eligibleUserId },
    include: {
      displayIdentity: {
        select: { nickname: true },
      },
    },
  });

  if (
    !user ||
    user.deletedAt ||
    !user.emailVerifiedAt ||
    !deps.verificationService.matchesVerificationGrantSubject(resolvedGrant, user.emailNormalized)
  ) {
    return authFailures.resetRestartRequired();
  }
  const emailNormalized = user.emailNormalized;

  const passwordDecision = deps.passwordPolicy.evaluateNewPassword(newPassword, {
    email: user.email,
    nickname: user.displayIdentity?.nickname,
  });
  if (!passwordDecision.ok) {
    deps.flowMetrics?.recordPasswordPolicyRejected('reset_password', passwordDecision.reason);
    return authFailures.passwordPolicyViolation(passwordDecision.message, 'newPassword');
  }

  let passwordHash: string;
  try {
    const samePassword = await verifyPasswordHash(user.passwordHash, newPassword, 'reset_verify');
    if (samePassword) {
      return authFailures.samePasswordNotAllowed();
    }
    passwordHash = await hashPassword(newPassword, 'reset_hash');
  } catch (error) {
    if (isPasswordHashCapacityUnavailableError(error)) {
      return authFailures.passwordHashCapacityUnavailable(error.retryAfterSeconds);
    }
    throw error;
  }
  const databaseNow = await deps.prisma.getDatabaseNow();

  try {
    await deps.prisma.runSerializableTransaction(async (tx) => {
      await acquireVerificationCodePurposeLock(tx, resolvedGrant.subjectKey, 'RESET_PASSWORD');
      await consumeVerificationGrantOrThrow(
        tx,
        {
          id: resolvedGrant.id,
          purpose: resolvedGrant.purpose,
          tokenHash: resolvedGrant.tokenHash,
        },
        databaseNow,
        RESET_VERIFICATION_GRANT_UNAVAILABLE,
      );

      const passwordUpdate = await tx.user.updateMany({
        where: {
          id: user.id,
          emailNormalized,
          passwordHash: user.passwordHash,
          deletedAt: null,
          emailVerifiedAt: { not: null },
        },
        data: { passwordHash },
      });
      if (passwordUpdate.count !== 1) {
        throw new Error(RESET_PASSWORD_OWNER_STALE);
      }

      const revokeResult = await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: databaseNow },
      });
      await deps.loginAttemptService.clearFailuresInTransaction(tx, emailNormalized);

      await deps.securityEvents.recordInTransaction(tx, {
        type: 'SESSION_REVOKE_ALL',
        severity: 'INFO',
        actorUserId: user.id,
        targetUserId: user.id,
        emailNormalized,
        requestIp: requestContext.requestIp,
        userAgent: requestContext.userAgent,
        metadata: {
          reason: 'reset_password',
          revokedCount: revokeResult.count,
        },
      });
      await deps.securityEvents.recordInTransaction(tx, {
        type: 'PASSWORD_RESET_SUCCEEDED',
        severity: 'INFO',
        actorUserId: user.id,
        targetUserId: user.id,
        emailNormalized,
        requestIp: requestContext.requestIp,
        userAgent: requestContext.userAgent,
        metadata: {
          loginAttemptState: 'cleared',
        },
      });
      await deps.mailOutboxWriter.appendPasswordChanged(tx, {
        targetUserId: user.id,
        email: user.email,
        now: databaseNow,
      });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      [RESET_VERIFICATION_GRANT_UNAVAILABLE, RESET_PASSWORD_OWNER_STALE].includes(error.message)
    ) {
      return authFailures.resetRestartRequired();
    }
    throw error;
  }

  return { success: true };
}
