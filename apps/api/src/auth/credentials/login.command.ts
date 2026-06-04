import type { LoginResult } from '../domain/auth.types.js';
import type { PrismaService } from '../../common/prisma/prisma.service.js';
import type { AuthLoginAttemptService } from '../login-attempts/auth-login-attempt.service.js';
import type { AuthSessionService } from '../sessions/auth-session.service.js';
import { toLoginSuccessResult } from '../mappers/auth-response.builder.js';
import { toAuthSessionUserSummary } from '../mappers/auth-user-view.js';
import { normalizeEmail } from '../domain/auth.utils.js';
import { verifyPasswordHash } from './auth-password.js';
import { hasUserDisplayIdentity } from '../../common/account-identity-invariant.owner.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from '../security-events/auth-security-event.service.js';
import { hasAuthRequestContext, type AuthRequestContext } from '../domain/auth-request-context.js';

interface AuthLoginOwnerDeps {
  prisma: PrismaService;
  loginAttemptService: Pick<
    AuthLoginAttemptService,
    'getActiveLock' | 'recordLoginFailure' | 'clearFailures'
  >;
  sessionService: Pick<AuthSessionService, 'issueAuthResult'>;
  securityEvents?: AuthSecurityEventService;
}

export async function login(
  deps: AuthLoginOwnerDeps,
  email: string,
  password: string,
  rememberMe: boolean,
  requestContext: AuthRequestContext = {},
): Promise<LoginResult> {
  const emailNormalized = normalizeEmail(email);
  const activeLock = await (hasAuthRequestContext(requestContext)
    ? deps.loginAttemptService.getActiveLock(emailNormalized, requestContext)
    : deps.loginAttemptService.getActiveLock(emailNormalized));
  if (activeLock) {
    return activeLock;
  }

  const user = await deps.prisma.user.findUnique({
    where: { emailNormalized },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      deletedAt: true,
      gender: true,
      campus: true,
      displayIdentity: {
        select: {
          nickname: true,
        },
      },
    },
  });

  if (!user) {
    return hasAuthRequestContext(requestContext)
      ? deps.loginAttemptService.recordLoginFailure(emailNormalized, requestContext)
      : deps.loginAttemptService.recordLoginFailure(emailNormalized);
  }

  if (user.deletedAt || !hasUserDisplayIdentity(user)) {
    return hasAuthRequestContext(requestContext)
      ? deps.loginAttemptService.recordLoginFailure(emailNormalized, requestContext)
      : deps.loginAttemptService.recordLoginFailure(emailNormalized);
  }

  const passwordMatches = await verifyPasswordHash(user.passwordHash, password);
  if (!passwordMatches) {
    return hasAuthRequestContext(requestContext)
      ? deps.loginAttemptService.recordLoginFailure(emailNormalized, requestContext)
      : deps.loginAttemptService.recordLoginFailure(emailNormalized);
  }

  await deps.loginAttemptService.clearFailures(emailNormalized);

  const authResult = await deps.sessionService.issueAuthResult(user.id, user.email, rememberMe);
  await recordAuthSecurityEventSafely(deps.securityEvents, {
    type: 'LOGIN_SUCCESS',
    severity: 'INFO',
    actorUserId: user.id,
    targetUserId: user.id,
    sessionId: authResult.sessionId,
    emailNormalized,
    requestIp: requestContext.requestIp,
    userAgent: requestContext.userAgent,
    metadata: {
      rememberMe,
    },
  });

  return toLoginSuccessResult(
    authResult.accessToken,
    toAuthSessionUserSummary({
      id: user.id,
      email: user.email,
      nickname: user.displayIdentity.nickname,
      gender: user.gender,
      campus: user.campus,
    }),
    { renewalToken: authResult.renewalToken, rememberMe },
  );
}
