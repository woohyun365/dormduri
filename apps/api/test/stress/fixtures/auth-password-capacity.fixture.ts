import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { hashAuthPersistenceDimension } from '../../../src/auth/persistence/auth-persistence-dimension.js';
import { hashOpaqueToken } from '../../../src/auth/sessions/opaque-token.js';
import { hashVerificationGrant } from '../../../src/auth/verification/grant/auth-verification-grant.js';
import { DEFAULT_DATABASE_URL } from '../../../src/config/database.config.js';
import { PrismaClient } from '../../../src/generated/prisma/client.js';
import {
  buildPrismaSessionOptions,
  stripPrismaConnectionOptions,
} from '../../../src/platform/database/prisma.service.js';
import { redactStressFixtureSecrets } from '../safety/stress-secret-redaction.js';
import { assertStressFixtureApplyAllowed } from './stress-fixture.apply-guard.js';
import { createStressFixtureConfigFromEnv } from './stress-fixture.config.js';
import { buildStressFixturePlan, type StressActorPlanRow } from './stress-fixture.plan.js';

const DEFAULT_ARTIFACT_PATH = 'test/stress/reports/.tmp-auth-password-capacity.json';
const DEFAULT_SIGNUP_COUNT = 320;
const GRANT_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const CAPACITY_COLLEGE_CODE = 'CHUNCHEON_ARTS_ENGINEERING';

export interface AuthPasswordCapacityLoginEntry {
  readonly index: number;
  readonly email: string;
  readonly password: string;
}

export interface AuthPasswordCapacitySignupEntry {
  readonly index: number;
  readonly email: string;
  readonly password: string;
  readonly nickname: string;
  readonly verificationGrant: string;
}

export interface AuthPasswordCapacityResetEntry {
  readonly index: number;
  readonly email: string;
  readonly newPassword: string;
  readonly verificationGrant: string;
}

export interface AuthPasswordCapacityChangeEntry {
  readonly index: number;
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly accessToken: string;
}

export interface AuthPasswordCapacityReadEntry {
  readonly index: number;
  readonly accessToken: string;
}

export interface AuthPasswordCapacityArtifact {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly marker: string;
  readonly legalAcceptances: {
    readonly termsVersionId: string;
    readonly privacyPolicyVersionIdShown: string;
    readonly personalDataConsentVersionId: string;
    readonly ageNoticeVersionId: string;
  };
  readonly loginSuccess: readonly AuthPasswordCapacityLoginEntry[];
  readonly loginFailure: readonly AuthPasswordCapacityLoginEntry[];
  readonly signup: readonly AuthPasswordCapacitySignupEntry[];
  readonly reset: readonly AuthPasswordCapacityResetEntry[];
  readonly change: readonly AuthPasswordCapacityChangeEntry[];
  readonly readTraffic: readonly AuthPasswordCapacityReadEntry[];
}

export function buildAuthPasswordCapacityArtifact(
  actors: readonly StressActorPlanRow[],
  marker: string,
  now = new Date(),
  signupCount = DEFAULT_SIGNUP_COUNT,
): AuthPasswordCapacityArtifact {
  if (actors.length < 4) {
    throw new Error('Auth password capacity fixture requires at least four seeded actors.');
  }

  const resetCount = Math.max(1, Math.min(Math.floor(actors.length * 0.25), 300));
  const changeCount = Math.max(1, Math.min(Math.floor(actors.length * 0.1), 100));
  const failureCount = Math.max(
    1,
    Math.min(Math.floor(actors.length * 0.3), actors.length - resetCount - changeCount - 1),
  );
  const resetActors = actors.slice(0, resetCount);
  const changeActors = actors.slice(resetCount, resetCount + changeCount);
  const failureActors = actors.slice(
    resetCount + changeCount,
    resetCount + changeCount + failureCount,
  );
  const successActors = actors.slice(resetCount + changeCount + failureCount);
  const legalAcceptances = legalDocumentIds(marker);

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    marker,
    legalAcceptances,
    loginSuccess: successActors.map((actor) => ({
      index: actor.index,
      email: actor.email,
      password: actor.password,
    })),
    loginFailure: failureActors.map((actor) => ({
      index: actor.index,
      email: actor.email,
      password: `${actor.password}-wrong`,
    })),
    signup: Array.from({ length: signupCount }, (_, zeroBasedIndex) => {
      const index = zeroBasedIndex + 1;
      const padded = String(index).padStart(4, '0');
      const email = `${marker}+capacity-signup-${padded}@kangwon.ac.kr`;
      return {
        index,
        email,
        password: `Signup!${padded}Capacity`,
        nickname: `부하${padded}`,
        verificationGrant: verificationGrant(marker, 'signup', index),
      };
    }),
    reset: resetActors.map((actor) => ({
      index: actor.index,
      email: actor.email,
      newPassword: `Reset!${String(actor.index).padStart(4, '0')}Capacity`,
      verificationGrant: verificationGrant(marker, 'reset', actor.index),
    })),
    change: changeActors.map((actor) => ({
      index: actor.index,
      currentPassword: actor.password,
      newPassword: `Change!${String(actor.index).padStart(4, '0')}Capacity`,
      accessToken: sessionToken(marker, actor.index),
    })),
    readTraffic: successActors.map((actor) => ({
      index: actor.index,
      accessToken: readSessionToken(marker, actor.index),
    })),
  };
}

export async function prepareAuthPasswordCapacityFixture(
  env: NodeJS.ProcessEnv = process.env,
): Promise<unknown> {
  assertStressFixtureApplyAllowed(env);
  const persistenceSecret = requireEnvironmentValue(env, 'AUTH_PERSISTENCE_HMAC_SECRET');
  const config = createStressFixtureConfigFromEnv(env);
  const plan = buildStressFixturePlan(config);
  const signupCount = positiveInteger(env.STRESS_AUTH_CAPACITY_SIGNUP_COUNT, DEFAULT_SIGNUP_COUNT);
  const now = new Date();
  const artifact = buildAuthPasswordCapacityArtifact(plan.actors, plan.marker, now, signupCount);
  const prisma = createPrismaClient(env);

  try {
    await resetAuthPasswordCapacityFixture(env, prisma);
    await prisma.collegeMaster.createMany({
      data: [
        {
          code: CAPACITY_COLLEGE_CODE,
          campusCode: 'CHUNCHEON',
          nameKo: '문화예술·공과대학',
          sortOrder: 10,
          isActive: true,
        },
      ],
      skipDuplicates: true,
    });
    await upsertLegalDocuments(prisma, artifact, now);
    await prisma.authSession.createMany({
      data: [
        ...artifact.change.map((entry) => ({
          id: capacitySessionId(plan.marker, entry.index),
          userId: actorByIndex(plan.actors, entry.index).userId,
          rememberMe: false,
          sessionTokenHash: hashOpaqueToken(entry.accessToken),
          sessionTokenExpiresAt: new Date(now.getTime() + SESSION_TTL_MS),
          expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
        })),
        ...artifact.readTraffic.map((entry) => ({
          id: capacityReadSessionId(plan.marker, entry.index),
          userId: actorByIndex(plan.actors, entry.index).userId,
          rememberMe: false,
          sessionTokenHash: hashOpaqueToken(entry.accessToken),
          sessionTokenExpiresAt: new Date(now.getTime() + SESSION_TTL_MS),
          expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
        })),
      ],
    });
    await prisma.verificationCode.createMany({
      data: [
        ...artifact.signup.map((entry) => ({
          id: capacityVerificationId(plan.marker, 'signup', entry.index),
          subjectKey: hashAuthPersistenceDimension(
            'subject',
            entry.email.toLowerCase(),
            persistenceSecret,
          ),
          purpose: 'SIGNUP' as const,
          codeHash: capacityCodeHash(plan.marker, 'signup', entry.index),
          issuedAt: now,
          codeExpiresAt: new Date(now.getTime() + GRANT_TTL_MS),
          verifiedAt: now,
          grantTokenHash: hashVerificationGrant(entry.verificationGrant),
          grantExpiresAt: new Date(now.getTime() + GRANT_TTL_MS),
        })),
        ...artifact.reset.map((entry) => ({
          id: capacityVerificationId(plan.marker, 'reset', entry.index),
          subjectKey: hashAuthPersistenceDimension(
            'subject',
            entry.email.toLowerCase(),
            persistenceSecret,
          ),
          purpose: 'RESET_PASSWORD' as const,
          codeHash: capacityCodeHash(plan.marker, 'reset', entry.index),
          issuedAt: now,
          codeExpiresAt: new Date(now.getTime() + GRANT_TTL_MS),
          verifiedAt: now,
          grantTokenHash: hashVerificationGrant(entry.verificationGrant),
          grantExpiresAt: new Date(now.getTime() + GRANT_TTL_MS),
          eligibleUserId: actorByIndex(plan.actors, entry.index).userId,
        })),
      ],
    });

    const outputPath = resolve(
      process.cwd(),
      env.STRESS_AUTH_CAPACITY_ARTIFACT_PATH || DEFAULT_ARTIFACT_PATH,
    );
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });

    return redactStressFixtureSecrets({
      outputPath,
      marker: artifact.marker,
      loginSuccessCount: artifact.loginSuccess.length,
      loginFailureCount: artifact.loginFailure.length,
      signupCount: artifact.signup.length,
      resetCount: artifact.reset.length,
      changeCount: artifact.change.length,
      sample: artifact.signup[0],
    });
  } finally {
    await disconnectPrisma(prisma);
  }
}

export async function resetAuthPasswordCapacityFixture(
  env: NodeJS.ProcessEnv = process.env,
  providedPrisma?: PrismaClient,
): Promise<unknown> {
  assertStressFixtureApplyAllowed(env);
  const marker = createStressFixtureConfigFromEnv(env).prefix;
  const prisma = providedPrisma ?? createPrismaClient(env);
  const ids = legalDocumentIds(marker);

  try {
    const deletedUsers = await prisma.user.deleteMany({
      where: { emailNormalized: { startsWith: `${marker}+capacity-signup-` } },
    });
    const deletedSessions = await prisma.authSession.deleteMany({
      where: { id: { startsWith: `${marker}-capacity-` } },
    });
    const deletedCodes = await prisma.verificationCode.deleteMany({
      where: { id: { startsWith: `${marker}-capacity-` } },
    });
    const deletedLegalDocuments = await prisma.legalDocumentVersion.deleteMany({
      where: { id: { in: Object.values(ids) } },
    });

    return {
      marker,
      deletedUsers: deletedUsers.count,
      deletedSessions: deletedSessions.count,
      deletedCodes: deletedCodes.count,
      deletedLegalDocuments: deletedLegalDocuments.count,
    };
  } finally {
    if (!providedPrisma) {
      await disconnectPrisma(prisma);
    }
  }
}

function createPrismaClient(env: NodeJS.ProcessEnv): PrismaClient {
  const connectionString = env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const schema = new URL(connectionString).searchParams.get('schema') ?? undefined;
  const pool = new Pool({
    connectionString: stripPrismaConnectionOptions(connectionString),
    max: 4,
    application_name: 'knu-roommate-auth-password-capacity-fixture',
    options: buildPrismaSessionOptions(schema ?? null),
  });
  return new PrismaClient({
    adapter: new PrismaPg(pool, { schema, disposeExternalPool: true }),
  });
}

async function disconnectPrisma(prisma: PrismaClient): Promise<void> {
  await prisma.$disconnect();
}

async function upsertLegalDocuments(
  prisma: PrismaClient,
  artifact: AuthPasswordCapacityArtifact,
  now: Date,
): Promise<void> {
  const rows = [
    [artifact.legalAcceptances.termsVersionId, 'TERMS_OF_SERVICE', '이용약관'],
    [artifact.legalAcceptances.privacyPolicyVersionIdShown, 'PRIVACY_POLICY', '개인정보 처리방침'],
    [
      artifact.legalAcceptances.personalDataConsentVersionId,
      'PERSONAL_DATA_COLLECTION_USE_CONSENT',
      '개인정보 수집·이용 동의',
    ],
    [artifact.legalAcceptances.ageNoticeVersionId, 'AGE_14_OR_ABOVE_NOTICE', '연령 확인'],
  ] as const;

  for (const [id, kind, title] of rows) {
    await prisma.legalDocumentVersion.upsert({
      where: { id },
      create: {
        id,
        kind,
        version: id,
        title: `스트레스 ${title}`,
        summaryItems: [],
        sections: [],
        publishedAt: now,
        effectiveAt: new Date(now.getTime() - 1_000),
      },
      update: {
        publishedAt: now,
        effectiveAt: new Date(now.getTime() - 1_000),
        retiredAt: null,
      },
    });
  }
}

function actorByIndex(actors: readonly StressActorPlanRow[], index: number): StressActorPlanRow {
  const actor = actors[index - 1];
  if (!actor) {
    throw new Error(`Missing stress actor for capacity index ${index}.`);
  }
  return actor;
}

function legalDocumentIds(marker: string) {
  return {
    termsVersionId: `${marker}-capacity-terms`,
    privacyPolicyVersionIdShown: `${marker}-capacity-privacy`,
    personalDataConsentVersionId: `${marker}-capacity-personal-data`,
    ageNoticeVersionId: `${marker}-capacity-age-notice`,
  } as const;
}

function verificationGrant(marker: string, kind: 'signup' | 'reset', index: number): string {
  const id = capacityVerificationId(marker, kind, index);
  return `v1.${id}.${deterministicSecret(`${marker}:${kind}:${index}`)}`;
}

function sessionToken(marker: string, index: number): string {
  const id = capacitySessionId(marker, index);
  return `v1.${id}.${deterministicSecret(`${marker}:session:${index}`)}`;
}

function readSessionToken(marker: string, index: number): string {
  const id = capacityReadSessionId(marker, index);
  return `v1.${id}.${deterministicSecret(`${marker}:read-session:${index}`)}`;
}

function deterministicSecret(input: string): string {
  return createHash('sha256').update(input).digest('base64url');
}

function capacityVerificationId(marker: string, kind: 'signup' | 'reset', index: number): string {
  return `${marker}-capacity-${kind}-${String(index).padStart(4, '0')}`;
}

function capacitySessionId(marker: string, index: number): string {
  return `${marker}-capacity-change-session-${String(index).padStart(4, '0')}`;
}

function capacityReadSessionId(marker: string, index: number): string {
  return `${marker}-capacity-read-session-${String(index).padStart(4, '0')}`;
}

function capacityCodeHash(marker: string, kind: string, index: number): string {
  return `stress:${createHash('sha256').update(`${marker}:${kind}:code:${index}`).digest('hex')}`;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requireEnvironmentValue(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required for auth password capacity fixture materialization.`);
  }
  return value;
}

function readMode(argv: readonly string[]): 'prepare' | 'reset' {
  return argv.includes('--reset') ? 'reset' : 'prepare';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result =
      readMode(process.argv.slice(2)) === 'reset'
        ? await resetAuthPasswordCapacityFixture()
        : await prepareAuthPasswordCapacityFixture();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export function readAuthPasswordCapacityArtifact(path: string): AuthPasswordCapacityArtifact {
  return JSON.parse(readFileSync(path, 'utf8')) as AuthPasswordCapacityArtifact;
}
