import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Campus, DormitorySelectionState, Gender } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  AUTH_SESSION_REMEMBER_ME_TTL_SECONDS,
  AUTH_SESSION_TTL_SECONDS,
  JWT_ACCESS_TTL_SECONDS,
} from './auth.constants.js';
import type { GenericSuccessResult, SessionStatusResult } from './auth.types.js';
import { toAuthUserView } from './auth-user-view.js';
import { apiEnv } from '../config/env.js';

export interface AuthenticatedUserContext {
  id: string;
  gender: Gender;
  campus: Campus;
  dormitoryId: string | null;
  dormitorySelectionState: DormitorySelectionState;
}

interface SessionUserViewRecord extends AuthenticatedUserContext {
  email: string;
  nickname: string;
  lifestyle: Prisma.JsonValue;
  intro: string;
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

    return {
      authenticated: true,
      user: toAuthUserView(user),
    };
  }

  async resolveCurrentUserContext(token: string | null): Promise<AuthenticatedUserContext | null> {
    const userId = await this.resolveAuthenticatedUserId(token);
    if (!userId) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        gender: true,
        campus: true,
        dormitoryId: true,
        dormitorySelectionState: true,
      },
    });
  }

  async issueAuthResult(userId: string, email: string, rememberMe: boolean) {
    const ttlSeconds = rememberMe ? AUTH_SESSION_REMEMBER_ME_TTL_SECONDS : AUTH_SESSION_TTL_SECONDS;

    const [session] = await this.prisma.$queryRawUnsafe<{ id: string }[]>(
      `
        INSERT INTO "AuthSession" (
          id,
          "userId",
          "rememberMe",
          "expiresAt"
        )
        VALUES (
          gen_random_uuid()::text,
          $1,
          $2,
          CURRENT_TIMESTAMP + INTERVAL '${ttlSeconds} seconds'
        )
        RETURNING id
      `,
      userId,
      rememberMe,
    );

    if (!session) {
      throw new Error('AuthSession insert failed');
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
        sid: session.id,
      },
      {
        secret: this.getJwtSecret(),
        expiresIn: JWT_ACCESS_TTL_SECONDS,
      },
    );

    return { accessToken, sessionId: session.id };
  }

  async logout(token: string | null): Promise<GenericSuccessResult> {
    if (!token) {
      return { success: true };
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sid?: string }>(token, {
        secret: this.getJwtSecret(),
      });
      if (payload.sid) {
        await this.prisma.$executeRawUnsafe(
          `
            UPDATE "AuthSession"
            SET "revokedAt" = CURRENT_TIMESTAMP
            WHERE id = $1 AND "revokedAt" IS NULL
          `,
          payload.sid,
        );
      }
    } catch {
      // clear cookie regardless
    }

    return { success: true };
  }

  private getJwtSecret(): string {
    return apiEnv.jwtSecret;
  }

  private async resolveCurrentSessionUser(
    token: string | null,
  ): Promise<SessionUserViewRecord | null> {
    const userId = await this.resolveAuthenticatedUserId(token);
    if (!userId) {
      return null;
    }

    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nickname: true,
        gender: true,
        campus: true,
        lifestyle: true,
        intro: true,
        dormitoryId: true,
        dormitorySelectionState: true,
      },
    });
  }

  private async resolveAuthenticatedUserId(token: string | null): Promise<string | null> {
    if (!token) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sid?: string; sub?: string }>(token, {
        secret: this.getJwtSecret(),
      });

      if (!payload.sid || !payload.sub) {
        return null;
      }

      const [session] = await this.prisma.$queryRawUnsafe<{ userId: string }[]>(
        `
          SELECT "userId"
          FROM "AuthSession"
          WHERE id = $1
            AND "userId" = $2
            AND "revokedAt" IS NULL
            AND "expiresAt" > CURRENT_TIMESTAMP
          LIMIT 1
        `,
        payload.sid,
        payload.sub,
      );

      return session?.userId ?? null;
    } catch {
      return null;
    }
  }
}
