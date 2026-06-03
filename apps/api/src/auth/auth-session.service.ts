import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Campus, Gender } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { getCurrentSessionUserId } from '../generated/prisma/sql.js';
import {
  AUTH_SESSION_REMEMBER_ME_TTL_SECONDS,
  AUTH_SESSION_TTL_SECONDS,
  JWT_ACCESS_TTL_SECONDS,
} from './auth.constants.js';
import type {
  AuthSessionUserSummary,
  AuthSessionIssueResult,
  GenericSuccessResult,
  RenewSessionResult,
  SessionStatusResult,
} from './auth.types.js';
import { toAuthenticatedSessionResult } from './auth-response.builder.js';
import { toAuthSessionUserSummary } from './auth-user-view.js';
import { hasUserDisplayIdentity } from '../common/account-identity-invariant.owner.js';
import { authFailures } from './auth-failures.js';

export interface AuthenticatedUserContext {
  id: string;
  sessionId?: string;
  gender: Gender;
  campus: Campus;
}

interface AuthenticatedSessionRef {
  userId: string;
  sessionId: string;
}

const RENEWAL_TOKEN_VERSION = 'v1';
const RENEWAL_TOKEN_BYTES = 32;
const RENEWAL_TOKEN_SECRET_LENGTH = 43;
const RENEWAL_TOKEN_SECRET_PATTERN = /^[A-Za-z0-9_-]+$/;

function createRenewalToken(sessionId: string) {
  return `${RENEWAL_TOKEN_VERSION}.${sessionId}.${randomBytes(RENEWAL_TOKEN_BYTES).toString('base64url')}`;
}

function hashRenewalToken(renewalToken: string) {
  return createHash('sha256').update(renewalToken).digest('hex');
}

function parseRenewalToken(renewalToken: string | null) {
  if (!renewalToken) {
    return null;
  }

  const [version, sessionId, secret, ...rest] = renewalToken.split('.');
  if (
    version !== RENEWAL_TOKEN_VERSION ||
    !sessionId ||
    !secret ||
    secret.length !== RENEWAL_TOKEN_SECRET_LENGTH ||
    !RENEWAL_TOKEN_SECRET_PATTERN.test(secret) ||
    rest.length > 0
  ) {
    return null;
  }

  return {
    sessionId,
    tokenHash: hashRenewalToken(renewalToken),
  };
}

function safeCompareTokenHash(expectedHash: string, actualHash: string) {
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(actualHash, 'hex');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async getSession(token: string | null): Promise<SessionStatusResult> {
    const user = await this.resolveCurrentSessionUser(token);
    if (!user) {
      return { authenticated: false };
    }

    return toAuthenticatedSessionResult(user);
  }

  async resolveCurrentUserContext(token: string | null): Promise<AuthenticatedUserContext | null> {
    const session = await this.resolveAuthenticatedSession(token);
    if (!session) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        gender: true,
        campus: true,
        deletedAt: true,
        displayIdentity: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!hasUserDisplayIdentity(user) || user.deletedAt) {
      return null;
    }

    return {
      id: user.id,
      sessionId: session.sessionId,
      gender: user.gender,
      campus: user.campus,
    };
  }

  async issueAuthResult(
    userId: string,
    email: string,
    rememberMe: boolean,
  ): Promise<AuthSessionIssueResult> {
    const ttlSeconds = rememberMe ? AUTH_SESSION_REMEMBER_ME_TTL_SECONDS : AUTH_SESSION_TTL_SECONDS;
    const databaseNow = await this.prisma.getDatabaseNow();
    const sessionId = randomUUID();
    const renewalToken = rememberMe ? createRenewalToken(sessionId) : undefined;

    const session = await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId,
        rememberMe,
        ...(renewalToken ? { refreshTokenHash: hashRenewalToken(renewalToken) } : {}),
        expiresAt: new Date(databaseNow.getTime() + ttlSeconds * 1000),
      },
      select: { id: true },
    });

    const accessToken = await this.signAccessToken(userId, email, session.id);

    return {
      accessToken,
      sessionId: session.id,
      ...(renewalToken ? { renewalToken } : {}),
    };
  }

  async renewSession(renewalToken: string | null): Promise<RenewSessionResult> {
    const parsedRenewalToken = parseRenewalToken(renewalToken);
    if (!parsedRenewalToken) {
      return authFailures.sessionRenewalRequired();
    }

    const databaseNow = await this.prisma.getDatabaseNow();
    const nextRenewalToken = createRenewalToken(parsedRenewalToken.sessionId);
    const nextRenewalTokenHash = hashRenewalToken(nextRenewalToken);

    const renewalAttempt = await this.prisma.runSerializableTransaction(async (tx) => {
      const session = await tx.authSession.findUnique({
        where: { id: parsedRenewalToken.sessionId },
        select: {
          id: true,
          userId: true,
          rememberMe: true,
          refreshTokenHash: true,
          expiresAt: true,
          revokedAt: true,
          user: {
            select: {
              email: true,
              deletedAt: true,
              displayIdentity: {
                select: { userId: true },
              },
            },
          },
        },
      });

      if (
        !session ||
        !session.rememberMe ||
        !session.refreshTokenHash ||
        session.revokedAt ||
        session.expiresAt <= databaseNow ||
        session.user.deletedAt ||
        !session.user.displayIdentity
      ) {
        return null;
      }

      if (!safeCompareTokenHash(session.refreshTokenHash, parsedRenewalToken.tokenHash)) {
        await tx.authSession.updateMany({
          where: {
            id: session.id,
            revokedAt: null,
          },
          data: {
            revokedAt: databaseNow,
          },
        });
        return { kind: 'reused' as const };
      }

      const rotation = await tx.authSession.updateMany({
        where: {
          id: session.id,
          rememberMe: true,
          refreshTokenHash: parsedRenewalToken.tokenHash,
          revokedAt: null,
          expiresAt: {
            gt: databaseNow,
          },
        },
        data: {
          refreshTokenHash: nextRenewalTokenHash,
        },
      });

      if (rotation.count !== 1) {
        return null;
      }

      return {
        kind: 'renewed' as const,
        userId: session.userId,
        email: session.user.email,
        sessionId: session.id,
      };
    });

    if (!renewalAttempt) {
      return authFailures.sessionRenewalRequired();
    }

    if (renewalAttempt.kind === 'reused') {
      return authFailures.sessionRenewalReused();
    }

    const accessToken = await this.signAccessToken(
      renewalAttempt.userId,
      renewalAttempt.email,
      renewalAttempt.sessionId,
    );
    return {
      success: true,
      accessToken,
      renewalToken: nextRenewalToken,
      rememberMe: true,
    };
  }

  async logout(
    token: string | null,
    renewalToken: string | null = null,
  ): Promise<GenericSuccessResult> {
    const sessionIds = new Set<string>();

    const parsedRenewalToken = parseRenewalToken(renewalToken);
    if (parsedRenewalToken) {
      sessionIds.add(parsedRenewalToken.sessionId);
    }

    if (!token && sessionIds.size === 0) {
      return { success: true };
    }

    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync<{ sid?: string }>(token);
        if (payload.sid) {
          sessionIds.add(payload.sid);
        }
      } catch {
        // clear cookie regardless
      }
    }

    if (sessionIds.size > 0) {
      const revokedAt = await this.prisma.getDatabaseNow();

      await this.prisma.authSession.updateMany({
        where: {
          id: { in: [...sessionIds] },
          revokedAt: null,
        },
        data: {
          revokedAt,
        },
      });
    }

    return { success: true };
  }

  private async signAccessToken(userId: string, email: string, sessionId: string) {
    return this.jwtService.signAsync(
      {
        sub: userId,
        email,
        sid: sessionId,
      },
      { expiresIn: JWT_ACCESS_TTL_SECONDS },
    );
  }

  private async resolveCurrentSessionUser(
    token: string | null,
  ): Promise<AuthSessionUserSummary | null> {
    const userId = await this.resolveAuthenticatedUserId(token);
    if (!userId) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
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

    if (!hasUserDisplayIdentity(user) || user.deletedAt) {
      return null;
    }

    return toAuthSessionUserSummary({
      id: user.id,
      email: user.email,
      nickname: user.displayIdentity.nickname,
      gender: user.gender,
      campus: user.campus,
    });
  }

  private async resolveAuthenticatedUserId(token: string | null): Promise<string | null> {
    const session = await this.resolveAuthenticatedSession(token);
    return session?.userId ?? null;
  }

  private async resolveAuthenticatedSession(
    token: string | null,
  ): Promise<AuthenticatedSessionRef | null> {
    if (!token) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sid?: string; sub?: string }>(token);

      if (!payload.sid || !payload.sub) {
        return null;
      }

      const [session] = await this.prisma.$queryRawTyped(
        getCurrentSessionUserId(payload.sid, payload.sub),
      );

      return session?.userId ? { userId: session.userId, sessionId: payload.sid } : null;
    } catch {
      return null;
    }
  }
}
