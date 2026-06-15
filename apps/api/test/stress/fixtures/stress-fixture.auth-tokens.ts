import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { redactStressFixtureSecrets } from '../safety/stress-secret-redaction.js';
import { assertStressFixtureApplyAllowed } from './stress-fixture.apply-guard.js';
import { createStressFixtureConfigFromEnv } from './stress-fixture.config.js';
import { buildActorTokenPlan } from './stress-fixture.materializer.js';
import { buildStressFixturePlan } from './stress-fixture.plan.js';

export interface StressActorTokenArtifactEntry {
  readonly index: number;
  readonly actorId: string;
  readonly role: string;
  readonly userId: string;
  readonly participantId: string;
  readonly targetUserId: string;
  readonly targetParticipantId: string;
  readonly threadId: string | null;
  readonly accessToken: string;
}

export interface StressActorTokenArtifact {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly targetUrl: string;
  readonly marker: string;
  readonly actors: readonly StressActorTokenArtifactEntry[];
}

interface LoginResponseShape {
  readonly success?: unknown;
  readonly accessToken?: unknown;
}

const DEFAULT_TOKEN_ARTIFACT_PATH = 'test/stress/reports/.tmp-stress-actor-tokens.json';

export async function buildStressActorTokenArtifact(
  env: NodeJS.ProcessEnv = process.env,
  loginActor: (input: { readonly email: string; readonly password: string }) => Promise<string> = (
    input,
  ) => loginStressActor(env, input),
): Promise<StressActorTokenArtifact> {
  const guard = assertStressFixtureApplyAllowed(env);
  const plan = buildStressFixturePlan(createStressFixtureConfigFromEnv(env));
  const tokenPlan = buildActorTokenPlan(plan);
  const actorLimit = parseActorLimit(env.STRESS_TOKEN_ACTOR_LIMIT, plan.actors.length);
  const selectedActors = plan.actors.slice(0, actorLimit);
  const actors: StressActorTokenArtifactEntry[] = [];

  for (const actor of selectedActors) {
    const actorPlan = tokenPlan[actor.index - 1];
    if (!actorPlan) {
      continue;
    }

    actors.push({
      ...actorPlan,
      accessToken: await loginActor({ email: actor.email, password: actor.password }),
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    targetUrl: guard.target.targetUrl,
    marker: plan.marker,
    actors,
  };
}

export function writeStressActorTokenArtifact(
  artifact: StressActorTokenArtifact,
  outputPath = process.env.STRESS_ACTOR_TOKENS_PATH || DEFAULT_TOKEN_ARTIFACT_PATH,
) {
  const resolvedPath = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(resolvedPath), { recursive: true });
  writeFileSync(resolvedPath, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });

  return {
    outputPath: resolvedPath,
    actorCount: artifact.actors.length,
    safeSummary: redactStressFixtureSecrets({
      outputPath: resolvedPath,
      actorCount: artifact.actors.length,
      marker: artifact.marker,
      sampleActor: artifact.actors[0] ?? null,
    }),
  };
}

async function loginStressActor(
  env: NodeJS.ProcessEnv,
  input: { readonly email: string; readonly password: string },
): Promise<string> {
  const guard = assertStressFixtureApplyAllowed(env);
  const response = await fetch(`${guard.target.targetUrl.replace(/\/$/u, '')}/auth/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'knu-roommate-stress-token-helper',
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      rememberMe: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Stress actor login failed with HTTP ${response.status}.`);
  }

  const body = (await response.json()) as LoginResponseShape;
  if (body.success !== true || typeof body.accessToken !== 'string' || !body.accessToken) {
    throw new Error('Stress actor login response did not contain an access token.');
  }

  return body.accessToken;
}

function parseActorLimit(input: string | undefined, max: number) {
  if (!input?.trim()) {
    return Math.min(max, 32);
  }

  const parsed = Number.parseInt(input, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('STRESS_TOKEN_ACTOR_LIMIT must be a positive integer.');
  }

  return Math.min(parsed, max);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const artifact = await buildStressActorTokenArtifact();
    const result = writeStressActorTokenArtifact(artifact);
    console.log(JSON.stringify(result.safeSummary, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
