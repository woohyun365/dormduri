import type { ChangePasswordResponse } from '@repo/shared/auth-response';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type {
  AuthenticatedUserContext,
  AuthSessionService,
} from '../sessions/auth-session.service.js';
import { authFailures } from '../errors/auth-failures.js';
import { hashPassword, verifyPasswordHash } from './password-hash.js';
import { validatePasswordPolicy } from '../domain/auth.utils.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from '../security-events/auth-security-event.service.js';
import type { AuthRequestContext } from '../domain/auth-request-context.js';

const CHANGE_PASSWORD_SESSION_UNAVAILABLE =
  '[AuthChangePasswordOwner] current authenticated session unavailable';

interface AuthChangePasswordOwnerDeps {
  prisma: PrismaService;
  sessionService: Pick<AuthSessionService, 'issueAuthResult'>;
  securityEvents?: AuthSecurityEventService;
}

export async function changePassword(
  deps: AuthChangePasswordOwnerDeps,
  authUser: AuthenticatedUserContext,
  currentPassword: string,
  newPassword: string,
  requestContext: AuthRequestContext = {},
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
  let revokedSessionCount = 0;

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

      const revokeResult = await tx.authSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: databaseNow },
      });
      revokedSessionCount = revokeResult.count;
    });
  } catch (error) {
    if (error instanceof Error && error.message === CHANGE_PASSWORD_SESSION_UNAVAILABLE) {
      return authFailures.reauthenticationRequired();
    }

    throw error;
  }

  const authResult = await deps.sessionService.issueAuthResult(user.id, user.email, rememberMe);
  await recordAuthSecurityEventSafely(deps.securityEvents, {
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
      revokedCount: revokedSessionCount,
    },
  });
  await recordAuthSecurityEventSafely(deps.securityEvents, {
    type: 'CHANGE_PASSWORD_SUCCESS',
    severity: 'INFO',
    actorUserId: user.id,
    targetUserId: user.id,
    sessionId: authResult.sessionId,
    emailNormalized: user.email,
    requestIp: requestContext.requestIp,
    userAgent: requestContext.userAgent,
  });
  return {
    success: true,
    accessToken: authResult.accessToken,
    ...(authResult.renewalToken ? { renewalToken: authResult.renewalToken } : {}),
    rememberMe,
  };
}
