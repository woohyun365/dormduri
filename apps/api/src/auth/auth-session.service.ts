import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Campus, Gender } from '../generated/prisma/enums.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  AUTH_ACCESS_TOKEN_TTL_SECONDS,
  AUTH_SESSION_REMEMBER_ME_TTL_SECONDS,
  AUTH_SESSION_TTL_SECONDS,
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
  user: {
    id: string;
    email: string;
    gender: Gender;
    campus: Campus;
    deletedAt: Date | null;
    displayIdentity: {
      userId: string;
      nickname: string;
    };
  };
}

const OPAQUE_TOKEN_VERSION = 'v1';
const OPAQUE_TOKEN_BYTES = 32;
const OPAQUE_TOKEN_SECRET_LENGTH = 43;
const OPAQUE_TOKEN_SECRET_PATTERN = /^[A-Za-z0-9_-]+$/;

function createOpaqueToken(sessionId: string) {
  return `${OPAQUE_TOKEN_VERSION}.${sessionId}.${randomBytes(OPAQUE_TOKEN_BYTES).toString('base64url')}`;
}

function hashOpaqueToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function parseOpaqueToken(token: string | null) {
  if (!token) {
    return null;
  }

  const [version, sessionId, secret, ...rest] = token.split('.');
  if (
    version !== OPAQUE_TOKEN_VERSION ||
    !sessionId ||
    !secret ||
    secret.length !== OPAQUE_TOKEN_SECRET_LENGTH ||
    !OPAQUE_TOKEN_SECRET_PATTERN.test(secret) ||
    rest.length > 0
  ) {
    return null;
  }

  return {
    sessionId,
    tokenHash: hashOpaqueToken(token),
  };
}

function safeCompareTokenHash(expectedHash: string, actualHash: string) {
  const expected = Buffer.from(expectedHash, 'hex');
  const actual = Buffer.from(actualHash, 'hex');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

@Injectable()
export class AuthSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async getSession(token: string | null): Promise<SessionStatusResult> {
    const session = await this.resolveAuthenticatedSession(token);
    if (!session) {
      return { authenticated: false };
    }

    return toAuthenticatedSessionResult(this.toSessionUserSummary(session));
  }

  async resolveCurrentUserContext(token: string | null): Promise<AuthenticatedUserContext | null> {
    const session = await this.resolveAuthenticatedSession(token);
    if (!session) {
      return null;
    }

    return {
      id: session.user.id,
      sessionId: session.sessionId,
      gender: session.user.gender,
      campus: session.user.campus,
    };
  }

  async issueAuthResult(
    userId: string,
    _email: string,
    rememberMe: boolean,
  ): Promise<AuthSessionIssueResult> {
    const ttlSeconds = rememberMe ? AUTH_SESSION_REMEMBER_ME_TTL_SECONDS : AUTH_SESSION_TTL_SECONDS;
    const databaseNow = await this.prisma.getDatabaseNow();
    const sessionId = randomUUID();
    const accessToken = createOpaqueToken(sessionId);
    const sessionTokenExpiresAt = new Date(
      databaseNow.getTime() + AUTH_ACCESS_TOKEN_TTL_SECONDS * 1000,
    );
    const renewalToken = rememberMe ? createOpaqueToken(sessionId) : undefined;

    const session = await this.prisma.authSession.create({
      data: {
        id: sessionId,
        userId,
        rememberMe,
        sessionTokenHash: hashOpaqueToken(accessToken),
        sessionTokenExpiresAt,
        ...(renewalToken ? { refreshTokenHash: hashOpaqueToken(renewalToken) } : {}),
        expiresAt: new Date(databaseNow.getTime() + ttlSeconds * 1000),
      },
      select: { id: true },
    });

    return {
      accessToken,
      sessionId: session.id,
      ...(renewalToken ? { renewalToken } : {}),
    };
  }

  async renewSession(renewalToken: string | null): Promise<RenewSessionResult> {
    const parsedRenewalToken = parseOpaqueToken(renewalToken);
    if (!parsedRenewalToken) {
      return authFailures.sessionRenewalRequired();
    }

    const databaseNow = await this.prisma.getDatabaseNow();
    const nextAccessToken = createOpaqueToken(parsedRenewalToken.sessionId);
    const nextAccessTokenHash = hashOpaqueToken(nextAccessToken);
    const nextAccessTokenExpiresAt = new Date(
      databaseNow.getTime() + AUTH_ACCESS_TOKEN_TTL_SECONDS * 1000,
    );
    const nextRenewalToken = createOpaqueToken(parsedRenewalToken.sessionId);
    const nextRenewalTokenHash = hashOpaqueToken(nextRenewalToken);

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
          sessionTokenHash: nextAccessTokenHash,
          sessionTokenExpiresAt: nextAccessTokenExpiresAt,
        },
      });

      if (rotation.count !== 1) {
        return null;
      }

      return {
        kind: 'renewed' as const,
      };
    });

    if (!renewalAttempt) {
      return authFailures.sessionRenewalRequired();
    }

    if (renewalAttempt.kind === 'reused') {
      return authFailures.sessionRenewalReused();
    }

    return {
      success: true,
      accessToken: nextAccessToken,
      renewalToken: nextRenewalToken,
      rememberMe: true,
    };
  }

  async logout(
    token: string | null,
    renewalToken: string | null = null,
  ): Promise<GenericSuccessResult> {
    const sessionIds = new Set<string>();

    const parsedRenewalToken = parseOpaqueToken(renewalToken);
    if (parsedRenewalToken) {
      const session = await this.prisma.authSession.findUnique({
        where: { id: parsedRenewalToken.sessionId },
        select: { id: true, refreshTokenHash: true },
      });
      if (
        session?.refreshTokenHash &&
        safeCompareTokenHash(session.refreshTokenHash, parsedRenewalToken.tokenHash)
      ) {
        sessionIds.add(session.id);
      }
    }

    const parsedAccessToken = parseOpaqueToken(token);
    if (parsedAccessToken) {
      const session = await this.prisma.authSession.findUnique({
        where: { sessionTokenHash: parsedAccessToken.tokenHash },
        select: { id: true },
      });
      if (session) {
        sessionIds.add(session.id);
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

  private toSessionUserSummary(session: AuthenticatedSessionRef): AuthSessionUserSummary {
    return toAuthSessionUserSummary({
      id: session.user.id,
      email: session.user.email,
      nickname: session.user.displayIdentity.nickname,
      gender: session.user.gender,
      campus: session.user.campus,
    });
  }

  private async resolveAuthenticatedSession(
    token: string | null,
  ): Promise<AuthenticatedSessionRef | null> {
    const parsedAccessToken = parseOpaqueToken(token);
    if (!parsedAccessToken) {
      return null;
    }

    const session = await this.prisma.authSession.findUnique({
      where: { sessionTokenHash: parsedAccessToken.tokenHash },
      select: {
        id: true,
        userId: true,
        sessionTokenExpiresAt: true,
        expiresAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            gender: true,
            campus: true,
            deletedAt: true,
            displayIdentity: {
              select: {
                userId: true,
                nickname: true,
              },
            },
          },
        },
      },
    });

    if (
      !session ||
      session.revokedAt ||
      !session.sessionTokenExpiresAt ||
      session.sessionTokenExpiresAt <= new Date() ||
      session.expiresAt <= new Date() ||
      session.user.deletedAt ||
      !hasUserDisplayIdentity(session.user)
    ) {
      return null;
    }

    return {
      userId: session.userId,
      sessionId: session.id,
      user: session.user,
    };
  }
}
