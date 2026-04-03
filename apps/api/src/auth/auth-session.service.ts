import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  AUTH_SESSION_REMEMBER_ME_TTL_SECONDS,
  AUTH_SESSION_TTL_SECONDS,
  JWT_ACCESS_TTL_SECONDS,
} from './auth.constants.js';
import type { GenericSuccessResult, SessionStatusResult } from './auth.types.js';
import { toAuthUserView } from './auth-user-view.js';
import { apiEnv } from '../config/env.js';

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async getSession(token: string | null): Promise<SessionStatusResult> {
    if (!token) {
      return { authenticated: false };
    }

    try {
      const payload = await this.jwtService.verifyAsync<{ sid?: string; sub?: string }>(token, {
        secret: this.getJwtSecret(),
      });

      if (!payload.sid || !payload.sub) {
        return { authenticated: false };
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

      if (!session) {
        return { authenticated: false };
      }

      const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) {
        return { authenticated: false };
      }

      return {
        authenticated: true,
        user: toAuthUserView(user),
      };
    } catch {
      return { authenticated: false };
    }
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
}
