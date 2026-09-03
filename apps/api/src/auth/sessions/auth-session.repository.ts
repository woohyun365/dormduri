import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';

const authenticatedSessionSelect = {
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
} satisfies Prisma.AuthSessionSelect;

const renewalSessionSelect = {
  id: true,
  userId: true,
  rememberMe: true,
  refreshTokenHash: true,
  previousRefreshTokenHash: true,
  previousRefreshTokenValidUntil: true,
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
} satisfies Prisma.AuthSessionSelect;

export type AuthenticatedSessionRecord = Prisma.AuthSessionGetPayload<{
  select: typeof authenticatedSessionSelect;
}>;

export type RenewalSessionRecord = Prisma.AuthSessionGetPayload<{
  select: typeof renewalSessionSelect;
}>;

type AuthSessionClient =
  Pick<PrismaService, 'authSession'> | Pick<Prisma.TransactionClient, 'authSession'>;

export type AuthSessionCreateClient = Pick<Prisma.TransactionClient, 'authSession'>;

export interface AuthSessionCreateInput {
  sessionId: string;
  userId: string;
  rememberMe: boolean;
  sessionTokenHash: string;
  sessionTokenExpiresAt: Date;
  refreshTokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class AuthSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  getDatabaseNow(): Promise<Date> {
    return this.prisma.getDatabaseNow();
  }

  runSerializableTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.runSerializableTransaction(operation);
  }

  createSession(input: AuthSessionCreateInput) {
    return this.createSessionWithClient(this.prisma, input);
  }

  createSessionWithClient(client: AuthSessionCreateClient, input: AuthSessionCreateInput) {
    return client.authSession.create({
      data: {
        id: input.sessionId,
        userId: input.userId,
        rememberMe: input.rememberMe,
        sessionTokenHash: input.sessionTokenHash,
        sessionTokenExpiresAt: input.sessionTokenExpiresAt,
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
      },
      select: { id: true },
    });
  }

  findAuthenticatedSessionByAccessTokenHash(
    tokenHash: string,
  ): Promise<AuthenticatedSessionRecord | null> {
    return this.prisma.authSession.findUnique({
      where: { sessionTokenHash: tokenHash },
      select: authenticatedSessionSelect,
    });
  }

  findRenewalSessionById(
    client: AuthSessionClient,
    sessionId: string,
  ): Promise<RenewalSessionRecord | null> {
    return client.authSession.findUnique({
      where: { id: sessionId },
      select: renewalSessionSelect,
    });
  }

  revokeSessionById(client: AuthSessionClient, sessionId: string, revokedAt: Date) {
    return client.authSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt,
      },
    });
  }

  rotateRenewalToken(
    client: AuthSessionClient,
    input: {
      sessionId: string;
      currentRefreshTokenHash: string;
      nextRenewalTokenHash: string;
      nextAccessTokenHash: string;
      nextAccessTokenExpiresAt: Date;
      previousRefreshTokenValidUntil: Date;
      rememberMe: boolean;
      databaseNow: Date;
    },
  ) {
    return client.authSession.updateMany({
      where: {
        id: input.sessionId,
        rememberMe: input.rememberMe,
        refreshTokenHash: input.currentRefreshTokenHash,
        revokedAt: null,
        expiresAt: {
          gt: input.databaseNow,
        },
      },
      data: {
        previousRefreshTokenHash: input.currentRefreshTokenHash,
        previousRefreshTokenValidUntil: input.previousRefreshTokenValidUntil,
        refreshTokenHash: input.nextRenewalTokenHash,
        sessionTokenHash: input.nextAccessTokenHash,
        sessionTokenExpiresAt: input.nextAccessTokenExpiresAt,
      },
    });
  }

  findLogoutSessionByRenewalId(sessionId: string) {
    return this.prisma.authSession.findUnique({
      where: { id: sessionId },
      select: { id: true, refreshTokenHash: true },
    });
  }

  findLogoutSessionByAccessTokenHash(tokenHash: string) {
    return this.prisma.authSession.findUnique({
      where: { sessionTokenHash: tokenHash },
      select: { id: true },
    });
  }

  revokeSessionsByIds(sessionIds: string[], revokedAt: Date) {
    return this.prisma.authSession.updateMany({
      where: {
        id: { in: sessionIds },
        revokedAt: null,
      },
      data: {
        revokedAt,
      },
    });
  }
}
