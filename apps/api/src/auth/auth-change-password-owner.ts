import type { ChangePasswordResponse } from '@repo/shared/auth-response';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { AuthenticatedUserContext, AuthSessionService } from './auth-session.service.js';
import { authFailures } from './auth-failures.js';
import { hashPassword, verifyPasswordHash } from './auth-password.js';
import { validatePasswordPolicy } from './auth.utils.js';

const CHANGE_PASSWORD_SESSION_UNAVAILABLE =
  '[AuthChangePasswordOwner] current authenticated session unavailable';

interface AuthChangePasswordOwnerDeps {
  prisma: PrismaService;
  sessionService: Pick<AuthSessionService, 'issueAuthResult'>;
}

export async function changePassword(
  deps: AuthChangePasswordOwnerDeps,
  authUser: AuthenticatedUserContext,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResponse> {
  if (!authUser.sessionId) {
    return authFailures.reauthenticationRequired();
  }

  const user = await deps.prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    return authFailures.currentPasswordInvalid();
  }

  const currentPasswordMatches = await verifyPasswordHash(user.passwordHash, currentPassword);
  if (!currentPasswordMatches) {
    return authFailures.currentPasswordInvalid();
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
  let rememberMe = false;

  try {
    await deps.prisma.runSerializableTransaction(async (tx) => {
      const currentSession = await tx.authSession.findFirst({
        where: {
          id: authUser.sessionId,
          userId: user.id,
          revokedAt: null,
          expiresAt: {
            gt: databaseNow,
          },
        },
        select: { rememberMe: true },
      });

      if (!currentSession) {
        throw new Error(CHANGE_PASSWORD_SESSION_UNAVAILABLE);
      }

      rememberMe = currentSession.rememberMe;

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
    if (error instanceof Error && error.message === CHANGE_PASSWORD_SESSION_UNAVAILABLE) {
      return authFailures.reauthenticationRequired();
    }

    throw error;
  }

  const authResult = await deps.sessionService.issueAuthResult(user.id, user.email, rememberMe);
  return {
    success: true,
    accessToken: authResult.accessToken,
    rememberMe,
  };
}
