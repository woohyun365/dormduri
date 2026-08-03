import type { LoginResult } from '../domain/auth.types.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { AuthLoginAttemptService } from '../login-attempts/auth-login-attempt.service.js';
import type { AuthLoginMetricsService } from '../login-attempts/auth-login-metrics.service.js';
import type { AuthSessionService } from '../sessions/auth-session.service.js';
import { toLoginSuccessResult } from '../mappers/auth-response.builder.js';
import { toAuthSessionUserSummary } from '../mappers/auth-user-view.js';
import { normalizeEmail } from '../domain/auth.utils.js';
import type { AuthPasswordHashPolicy } from './auth-password-hash.adapter.js';
import { hasUserDisplayIdentity } from '../../identity/account-identity-invariant.js';
import {
  AuthSecurityEventService,
  recordAuthSecurityEventSafely,
} from '../security-events/auth-security-event.service.js';
import { hasAuthRequestContext, type AuthRequestContext } from '../domain/auth-request-context.js';
import { parseLoginPasswordInput } from '@repo/shared/auth/policy';

interface AuthLoginOwnerDeps {
  prisma: PrismaService;
  loginAttemptService: Pick<
    AuthLoginAttemptService,
    'getActiveLock' | 'recordLoginFailure' | 'clearFailures'
  >;
  loginMetrics: Pick<AuthLoginMetricsService, 'recordAttempt'>;
  passwordHashPolicy: Pick<
    AuthPasswordHashPolicy,
    'verifyLoginPassword' | 'verifyUnavailableLogin'
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
    deps.loginMetrics.recordAttempt('locked');
    return activeLock;
  }

  if (!parseLoginPasswordInput(password).ok) {
    const failure = hasAuthRequestContext(requestContext)
      ? deps.loginAttemptService.recordLoginFailure(emailNormalized, requestContext)
      : deps.loginAttemptService.recordLoginFailure(emailNormalized);
    const result = await failure;
    deps.loginMetrics.recordAttempt(result.code === 'AUTH_LOGIN_LOCKED' ? 'locked' : 'invalid');
    return result;
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

  if (!user || user.deletedAt || !hasUserDisplayIdentity(user)) {
    await deps.passwordHashPolicy.verifyUnavailableLogin(password);
    const failure = hasAuthRequestContext(requestContext)
      ? deps.loginAttemptService.recordLoginFailure(emailNormalized, requestContext)
      : deps.loginAttemptService.recordLoginFailure(emailNormalized);
    const result = await failure;
    deps.loginMetrics.recordAttempt(result.code === 'AUTH_LOGIN_LOCKED' ? 'locked' : 'invalid');
    return result;
  }

  const passwordMatches = await deps.passwordHashPolicy.verifyLoginPassword(
    user.passwordHash,
    password,
  );
  if (!passwordMatches) {
    const failure = hasAuthRequestContext(requestContext)
      ? deps.loginAttemptService.recordLoginFailure(emailNormalized, requestContext)
      : deps.loginAttemptService.recordLoginFailure(emailNormalized);
    const result = await failure;
    deps.loginMetrics.recordAttempt(result.code === 'AUTH_LOGIN_LOCKED' ? 'locked' : 'invalid');
    return result;
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
  deps.loginMetrics.recordAttempt('success');

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
