#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const orderedProfiles = ['h1', 'h2', 'h3', 'h7', 'h4', 'h5', 'h6', 'h9', 'h8'];
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');

try {
  const selectedProfiles = parseProfiles(process.env.STRESS_LOCAL_REHEARSAL_PROFILES || 'h1');
  assertRehearsalInputs(selectedProfiles);

  const preflight = spawnSync('pnpm', ['--dir', 'apps/api', 'stress:local:preflight'], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (preflight.status !== 0) {
    process.exit(preflight.status ?? 1);
  }

  for (const [index, profile] of selectedProfiles.entries()) {
    const result = spawnSync(
      'pnpm',
      ['--dir', 'apps/api', 'stress:docker:auth-password-capacity'],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          ...authProfileEnvironment(profile),
          STRESS_DOCKER_LOCAL_REHEARSAL: 'true',
          STRESS_AUTH_CAPACITY_PROFILE: profile,
          STRESS_DOCKER_SKIP_BUILD:
            index === 0 ? process.env.STRESS_DOCKER_SKIP_BUILD || 'false' : 'true',
        },
        stdio: 'inherit',
      },
    );

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function authProfileEnvironment(profile) {
  if (profile !== 'h9') {
    return {};
  }
  return {
    STRESS_API_AUTH_THROTTLE_LIMIT: '60',
    STRESS_API_AUTH_LOGIN_BURST_LIMIT: '30',
    STRESS_API_AUTH_LOGIN_SUSTAINED_LIMIT: '120',
    // k6 -> host gateway -> nginx -> API. H9 only trusts both isolated rehearsal hops
    // so its synthetic X-Forwarded-For values exercise same-IP and distributed-IP buckets.
    STRESS_API_HTTP_TRUST_PROXY_HOPS: '2',
  };
}

function assertRehearsalInputs(selectedProfiles) {
  if (process.env.STRESS_AUTH_CAPACITY_RATE || process.env.STRESS_AUTH_CAPACITY_DURATION) {
    throw new Error(
      'Local rehearsal은 profile 기본 duration과 arrival rate를 사용해야 해요. 짧은 배선 확인은 stress:docker:auth-password-capacity를 사용해 주세요.',
    );
  }

  if (
    selectedProfiles.includes('h8') &&
    process.env.STRESS_LOCAL_REHEARSAL_INCLUDE_SOAK !== 'I_UNDERSTAND_60_MINUTES'
  ) {
    throw new Error(
      'H8은 60분 soak예요. STRESS_LOCAL_REHEARSAL_INCLUDE_SOAK=I_UNDERSTAND_60_MINUTES를 명시해 주세요.',
    );
  }
}

function parseProfiles(input) {
  const requested = input.trim().toLowerCase();
  if (requested === 'all') {
    return [...orderedProfiles];
  }
  const profiles = [...new Set(requested.split(',').map((value) => value.trim()))].filter(Boolean);
  if (profiles.length === 0 || profiles.some((profile) => !orderedProfiles.includes(profile))) {
    throw new Error(`지원하지 않는 local rehearsal profile이에요: ${input}`);
  }
  return profiles;
}
