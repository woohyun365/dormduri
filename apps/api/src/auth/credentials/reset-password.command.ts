import type { GenericSuccessResult } from '../domain/auth.types.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { AuthVerificationService } from '../verification/auth-verification.service.js';
import { authFailures } from '../errors/auth-failures.js';
import { validatePasswordPolicy } from '../domain/auth.utils.js';
import { hashPassword, verifyPasswordHash } from './password-hash.js';
import {
  acquireVerificationCodePurposeLock,
  consumeVerificationGrantOrThrow,
  RESET_VERIFICATION_PROOF_UNAVAILABLE,
} from '../verification/auth-verification-proof.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from '../security-events/auth-security-event.service.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';
import type { AuthLoginAttemptService } from '../login-attempts/auth-login-attempt.service.js';

interface AuthResetPasswordOwnerDeps {
  prisma: PrismaService;
  verificationService: Pick<AuthVerificationService, 'resolveVerificationGrant'>;
  loginAttemptService: Pick<AuthLoginAttemptService, 'clearFailuresInTransaction'>;
  securityEvents?: AuthSecurityEventService;
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

  const emailNormalized = resolvedGrant.emailNormalized;
  const user = await deps.prisma.user.findUnique({
    where: { id: resolvedGrant.eligibleUserId },
  });

  if (
    !user ||
    user.deletedAt ||
    !user.emailVerifiedAt ||
    user.emailNormalized !== emailNormalized
  ) {
    return authFailures.resetRestartRequired();
  }

  const passwordError = validatePasswordPolicy(newPassword, user.email);
  if (passwordError) {
    return authFailures.passwordPolicyViolation(passwordError, 'newPassword');
  }

  const samePassword = await verifyPasswordHash(user.passwordHash, newPassword);
  if (samePassword) {
    return authFailures.samePasswordNotAllowed();
  }

  const passwordHash = await hashPassword(newPassword);
  const databaseNow = await deps.prisma.getDatabaseNow();
  let revokedSessionCount = 0;

  try {
    await deps.prisma.runSerializableTransaction(async (tx) => {
      await acquireVerificationCodePurposeLock(tx, emailNormalized, 'RESET_PASSWORD');
      await consumeVerificationGrantOrThrow(
        tx,
        {
          id: resolvedGrant.id,
          purpose: resolvedGrant.purpose,
          tokenHash: resolvedGrant.tokenHash,
        },
        databaseNow,
        RESET_VERIFICATION_PROOF_UNAVAILABLE,
      );

      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      const revokeResult = await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: databaseNow },
      });
      revokedSessionCount = revokeResult.count;
      await deps.loginAttemptService.clearFailuresInTransaction(tx, emailNormalized);
    });
  } catch (error) {
    if (error instanceof Error && error.message === RESET_VERIFICATION_PROOF_UNAVAILABLE) {
      return authFailures.resetRestartRequired();
    }
    throw error;
  }

  await recordAuthSecurityEventSafely(deps.securityEvents, {
    type: 'SESSION_REVOKE_ALL',
    severity: 'INFO',
    actorUserId: user.id,
    targetUserId: user.id,
    emailNormalized,
    requestIp: requestContext.requestIp,
    userAgent: requestContext.userAgent,
    metadata: {
      reason: 'reset_password',
      revokedCount: revokedSessionCount,
    },
  });

  await recordAuthSecurityEventSafely(deps.securityEvents, {
    type: 'RESET_PASSWORD_CONSUMED',
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

  return { success: true };
}
