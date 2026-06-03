import type { LoginResult } from './auth.types.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { AuthLoginAttemptService } from './auth-login-attempt.service.js';
import type { AuthSessionService } from './auth-session.service.js';
import { toLoginSuccessResult } from './auth-response.builder.js';
import { toAuthSessionUserSummary } from './auth-user-view.js';
import { normalizeEmail } from './auth.utils.js';
import { verifyPasswordHash } from './auth-password.js';
import { hasUserDisplayIdentity } from '../common/account-identity-invariant.owner.js';

interface AuthLoginOwnerDeps {
  prisma: PrismaService;
  loginAttemptService: Pick<
    AuthLoginAttemptService,
    'getActiveLock' | 'recordLoginFailure' | 'clearFailures'
  >;
  sessionService: Pick<AuthSessionService, 'issueAuthResult'>;
}

export async function login(
  deps: AuthLoginOwnerDeps,
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<LoginResult> {
  const emailNormalized = normalizeEmail(email);
  const activeLock = await deps.loginAttemptService.getActiveLock(emailNormalized);
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
    return deps.loginAttemptService.recordLoginFailure(emailNormalized);
  }

  if (user.deletedAt || !hasUserDisplayIdentity(user)) {
    return deps.loginAttemptService.recordLoginFailure(emailNormalized);
  }

  const passwordMatches = await verifyPasswordHash(user.passwordHash, password);
  if (!passwordMatches) {
    return deps.loginAttemptService.recordLoginFailure(emailNormalized);
  }

  await deps.loginAttemptService.clearFailures(emailNormalized);

  const authResult = await deps.sessionService.issueAuthResult(user.id, user.email, rememberMe);
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
