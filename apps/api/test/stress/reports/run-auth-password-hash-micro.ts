import { hash as argonHash } from '@node-rs/argon2';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { AUTH_PASSWORD_HASH_OPTIONS } from '../../../src/auth/credentials/password-hashing/password-hash.js';

const DEFAULT_LEVELS = [1, 5, 10, 20, 40, 100] as const;
const MICRO_PASSWORD = 'Capacity!Micro2026';

export interface AuthPasswordHashMicroLevelResult {
  readonly concurrency: number;
  readonly completed: number;
  readonly failed: number;
  readonly wallDurationMs: number;
  readonly p50Ms?: number;
  readonly p95Ms?: number;
  readonly p99Ms?: number;
  readonly rssBeforeBytes: number;
  readonly rssPeakBytes: number;
}

export interface AuthPasswordHashMicroReport {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly argon2: {
    readonly memoryCostKiB: number;
    readonly timeCost: number;
    readonly parallelism: number;
  };
  readonly levels: readonly AuthPasswordHashMicroLevelResult[];
  readonly secretMaterialDetected: false;
}

interface MicroBenchmarkDeps {
  readonly hashOperation?: () => Promise<unknown>;
  readonly readRss?: () => number;
}

export async function runAuthPasswordHashMicroBenchmark(
  concurrencyLevels: readonly number[],
  deps: MicroBenchmarkDeps = {},
): Promise<AuthPasswordHashMicroReport> {
  const hashOperation =
    deps.hashOperation ?? (() => argonHash(MICRO_PASSWORD, AUTH_PASSWORD_HASH_OPTIONS));
  const readRss = deps.readRss ?? (() => process.memoryUsage().rss);
  const levels: AuthPasswordHashMicroLevelResult[] = [];

  for (const concurrency of concurrencyLevels) {
    const normalizedConcurrency = positiveInteger(concurrency);
    const rssBeforeBytes = readRss();
    let rssPeakBytes = rssBeforeBytes;
    const sampler = setInterval(() => {
      rssPeakBytes = Math.max(rssPeakBytes, readRss());
    }, 5);
    sampler.unref();
    const wallStartedAt = performance.now();
    const observations = await Promise.all(
      Array.from({ length: normalizedConcurrency }, async () => {
        const startedAt = performance.now();
        try {
          await hashOperation();
          return { ok: true as const, durationMs: performance.now() - startedAt };
        } catch {
          return { ok: false as const, durationMs: performance.now() - startedAt };
        }
      }),
    );
    clearInterval(sampler);
    rssPeakBytes = Math.max(rssPeakBytes, readRss());
    const successfulDurations = observations
      .filter((entry) => entry.ok)
      .map((entry) => entry.durationMs)
      .sort((left, right) => left - right);

    levels.push({
      concurrency: normalizedConcurrency,
      completed: successfulDurations.length,
      failed: observations.length - successfulDurations.length,
      wallDurationMs: round(performance.now() - wallStartedAt),
      p50Ms: percentile(successfulDurations, 0.5),
      p95Ms: percentile(successfulDurations, 0.95),
      p99Ms: percentile(successfulDurations, 0.99),
      rssBeforeBytes,
      rssPeakBytes,
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    argon2: {
      memoryCostKiB: AUTH_PASSWORD_HASH_OPTIONS.memoryCost,
      timeCost: AUTH_PASSWORD_HASH_OPTIONS.timeCost,
      parallelism: AUTH_PASSWORD_HASH_OPTIONS.parallelism,
    },
    levels,
    secretMaterialDetected: false,
  };
}

function percentile(values: readonly number[], quantile: number): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const index = Math.min(values.length - 1, Math.ceil(values.length * quantile) - 1);
  return round(values[index] ?? 0);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function positiveInteger(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Invalid auth password hash micro concurrency: ${value}`);
  }
  return value;
}

function parseLevels(input: string | undefined): number[] {
  if (!input?.trim()) {
    return [...DEFAULT_LEVELS];
  }
  return input.split(',').map((value) => positiveInteger(Number.parseInt(value.trim(), 10)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await runAuthPasswordHashMicroBenchmark(
    parseLevels(process.env.STRESS_AUTH_HASH_MICRO_LEVELS),
  );
  const outputPath = process.env.STRESS_AUTH_HASH_MICRO_REPORT_PATH?.trim();
  if (outputPath) {
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  }
  console.log(JSON.stringify(report, null, 2));
}
