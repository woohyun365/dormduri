import { afterAll, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { AuthSessionService } from '../../../src/auth/sessions/auth-session.service.js';
import { hashPassword } from '../../../src/auth/credentials/password-hashing/password-hash.js';
import { LifecycleSweepService } from '../../../src/lifecycle/lifecycle-sweep.service.js';
import { PrismaService } from '../../../src/platform/database/prisma.service.js';
import { createIntegrationApp } from './integration-app.js';
import { createIntegrationDatabaseSandbox, truncateIntegrationSchema } from './integration-db.js';
import {
  DEFAULT_LIFESTYLE,
  toCompleteLifestyleColumnData,
} from './fixtures/lifestyle-profile.fixture.js';
import { seedBaseSeasonFixtures } from './fixtures/reference-data.fixture.js';

const retainedVaultEnv = {
  RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 20).toString('base64'),
  RETENTION_IDENTITY_KEY_VERSION: 'account-deletion-identity-v1',
  RETENTION_VAULT_NICKNAME_AUDIT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 21).toString('base64'),
  RETENTION_VAULT_NICKNAME_AUDIT_KEY_VERSION: 'account-deletion-nickname-v1',
  RETENTION_VAULT_ACADEMIC_IDENTITY_AUDIT_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 25).toString(
    'base64',
  ),
  RETENTION_VAULT_ACADEMIC_IDENTITY_AUDIT_KEY_VERSION: 'account-deletion-academic-v1',
  RETENTION_VAULT_SEASON_PROFILE_HISTORY_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 22).toString(
    'base64',
  ),
  RETENTION_VAULT_SEASON_PROFILE_HISTORY_KEY_VERSION: 'account-deletion-profile-v1',
  RETENTION_VAULT_MATCH_HISTORY_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 23).toString('base64'),
  RETENTION_VAULT_MATCH_HISTORY_KEY_VERSION: 'account-deletion-match-v1',
  RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 24).toString('base64'),
  RETENTION_VAULT_CHAT_BODY_KEY_VERSION: 'account-deletion-chat-v1',
} as const;

export function useAccountLifecycleIntegrationFixture(sandboxName: string) {
  let previousEnv: Partial<Record<keyof typeof retainedVaultEnv, string | undefined>>;
  let prisma: PrismaService;
  let authSessionService: AuthSessionService;
  let lifecycleSweepService: LifecycleSweepService;
  let httpServer: Parameters<typeof request>[0];
  let closeApp: (() => Promise<void>) | null = null;
  let cleanupDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    previousEnv = Object.fromEntries(
      Object.keys(retainedVaultEnv).map((key) => [
        key,
        process.env[key as keyof typeof retainedVaultEnv],
      ]),
    );
    Object.assign(process.env, retainedVaultEnv);
    const sandbox = await createIntegrationDatabaseSandbox(sandboxName);
    cleanupDb = sandbox.cleanup;
    const integration = await createIntegrationApp();
    closeApp = () => integration.app.close();
    prisma = integration.prisma;
    authSessionService = integration.app.get(AuthSessionService);
    lifecycleSweepService = integration.app.get(LifecycleSweepService);
    httpServer = integration.app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    if (closeApp) await closeApp();
    if (cleanupDb) await cleanupDb();
    for (const key of Object.keys(retainedVaultEnv) as Array<keyof typeof retainedVaultEnv>) {
      const previous = previousEnv[key];
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  beforeEach(async () => {
    await truncateIntegrationSchema(prisma);
    await seedBaseSeasonFixtures(prisma);
  });

  async function seedVerifiedUser(input: {
    userId: string;
    email: string;
    nickname: string;
    withParticipant?: boolean;
  }) {
    const now = await prisma.getDatabaseNow();
    const passwordHash = await hashPassword('Pass1234');
    await prisma.user.create({
      data: {
        id: input.userId,
        email: input.email,
        emailNormalized: input.email.toLowerCase(),
        passwordHash,
        gender: 'M',
        campus: 'CHUNCHEON',
        emailVerifiedAt: new Date(now.getTime() - 24 * 60 * 60 * 1_000),
      },
    });
    await prisma.userDisplayIdentity.create({
      data: {
        userId: input.userId,
        nickname: input.nickname,
        nicknameNormalized: input.nickname,
      },
    });
    await prisma.userAcademicIdentity.create({
      data: { userId: input.userId, collegeCode: 'CHUNCHEON_ARTS_ENGINEERING', birthYear: 2002 },
    });

    if (!input.withParticipant) return;
    const registeredAt = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
    await prisma.seasonParticipant.create({
      data: {
        id: `${input.userId}-participant`,
        seasonId: 'season-integration',
        userId: input.userId,
        participationIntent: 'REGISTERED',
        registeredAt,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
        joinedAt: now,
        activatedAt: now,
      },
    });
    await prisma.seasonParticipantProfile.create({
      data: {
        participantId: `${input.userId}-participant`,
        nicknameSnapshot: input.nickname,
        nicknameNormalizedSnapshot: input.nickname,
        ...toCompleteLifestyleColumnData(DEFAULT_LIFESTYLE),
        intro: `${input.nickname} 시즌 소개`,
      },
    });
    await prisma.seasonParticipantProfileHistory.create({
      data: {
        participantId: `${input.userId}-participant`,
        seasonId: 'season-integration',
        source: 'SEASON_REGISTRATION',
        nicknameSnapshot: input.nickname,
        nicknameNormalizedSnapshot: input.nickname,
        ...toCompleteLifestyleColumnData(DEFAULT_LIFESTYLE),
        intro: `${input.nickname} 시즌 소개`,
        registeredAtSnapshot: registeredAt,
      },
    });
  }

  async function issueAccessToken(userId: string, email: string) {
    return (await authSessionService.issueAuthResult(userId, email, false)).accessToken;
  }

  async function seedRegistrationReadyDraftUser(input: {
    userId: string;
    email: string;
    nickname: string;
    participantId: string;
  }) {
    const now = await prisma.getDatabaseNow();
    await seedVerifiedUser(input);
    await prisma.seasonParticipant.create({
      data: {
        id: input.participantId,
        seasonId: 'season-integration',
        userId: input.userId,
        participationIntent: 'UNDECIDED',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'SELECTED',
        participantStatus: 'DRAFT',
        campusCodeSnapshot: 'CHUNCHEON',
        genderSnapshot: 'M',
        joinedAt: now,
      },
    });
    await prisma.seasonParticipantProfile.create({
      data: {
        participantId: input.participantId,
        nicknameSnapshot: input.nickname,
        nicknameNormalizedSnapshot: input.nickname,
        ...toCompleteLifestyleColumnData(DEFAULT_LIFESTYLE),
        intro: `${input.nickname} 등록 준비 소개`,
        collegeCode: 'CHUNCHEON_ARTS_ENGINEERING',
        grade: '3',
        mbti: 'INTJ',
        birthYear: 2002,
      },
    });
  }

  return {
    get prisma() {
      return prisma;
    },
    get lifecycleSweepService() {
      return lifecycleSweepService;
    },
    get httpServer() {
      return httpServer;
    },
    seedVerifiedUser,
    issueAccessToken,
    seedRegistrationReadyDraftUser,
  };
}
