import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
  SessionStatusResult,
} from './auth.types.js';
import { toAuthenticatedSessionResult } from './auth-response.builder.js';
import { toAuthSessionUserSummary } from './auth-user-view.js';
import { hasUserDisplayIdentity } from '../common/account-identity-invariant.owner.js';

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

    const session = await this.prisma.authSession.create({
      data: {
        userId,
        rememberMe,
        expiresAt: new Date(databaseNow.getTime() + ttlSeconds * 1000),
      },
      select: { id: true },
    });

    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
        sid: session.id,
      },
      { expiresIn: JWT_ACCESS_TTL_SECONDS },
    );

    return { accessToken, sessionId: session.id };
  }

  async logout(token: string | null): Promise<GenericSuccessResult> {
    if (!token) {
      return { success: true };
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sid?: string }>(token);
      if (payload.sid) {
        const revokedAt = await this.prisma.getDatabaseNow();

        await this.prisma.authSession.updateMany({
          where: {
            id: payload.sid,
            revokedAt: null,
          },
          data: {
            revokedAt,
          },
        });
      }
    } catch {
      // clear cookie regardless
    }

    return { success: true };
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
