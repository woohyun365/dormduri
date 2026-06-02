import type { GenericSuccessResult } from './auth.types.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { AuthVerificationService } from './auth-verification.service.js';
import { authFailures } from './auth-failures.js';
import { normalizeEmail, validatePasswordPolicy } from './auth.utils.js';
import { hashPassword, verifyPasswordHash } from './auth-password.js';
import {
  consumeVerifiedCodeOrThrow,
  RESET_VERIFICATION_PROOF_UNAVAILABLE,
} from './auth-verification-proof.js';

interface AuthResetPasswordOwnerDeps {
  prisma: PrismaService;
  verificationService: Pick<AuthVerificationService, 'findLatestVerifiedResetCode'>;
}

export async function resetPassword(
  deps: AuthResetPasswordOwnerDeps,
  email: string,
  newPassword: string,
): Promise<GenericSuccessResult> {
  const emailNormalized = normalizeEmail(email);
  const user = await deps.prisma.user.findUnique({
    where: { emailNormalized },
  });

  if (!user || user.deletedAt || !user.emailVerifiedAt) {
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

  const verifiedCode = await deps.verificationService.findLatestVerifiedResetCode(emailNormalized);
  if (!verifiedCode) {
    return authFailures.resetRestartRequired();
  }

  const passwordHash = await hashPassword(newPassword);
  const databaseNow = await deps.prisma.getDatabaseNow();

  try {
    await deps.prisma.runSerializableTransaction(async (tx) => {
      await consumeVerifiedCodeOrThrow(
        tx,
        verifiedCode.id,
        databaseNow,
        RESET_VERIFICATION_PROOF_UNAVAILABLE,
      );

      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: databaseNow },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === RESET_VERIFICATION_PROOF_UNAVAILABLE) {
      return authFailures.resetRestartRequired();
    }
    throw error;
  }

  return { success: true };
}
