import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'test/stress/docker/run-dockerized-smoke.mjs'),
  'utf8',
);
const productionLikeSource = readFileSync(
  resolve(process.cwd(), 'test/stress/docker/run-production-like-evidence.mjs'),
  'utf8',
);
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
  readonly scripts?: Record<string, string>;
};

describe('dockerized stress smoke runner', () => {
  it('keeps Phase 9-1 docker API/nginx smoke steps executable from one script', () => {
    expect(source).toContain('docker-compose.api.yml');
    expect(source).toContain('api compose build');
    expect(source).toContain('api compose up');
    expect(source).toContain('compose config validated without printing rendered env');
    expect(source).toContain('docker stats snapshot');
    expect(source).toContain('/health/ready');
    expect(source).toContain('/internal/metrics');
  });

  it('runs authenticated fixture, k6, and realtime smoke against the dockerized target', () => {
    expect(source).toContain('stress:fixture:seed');
    expect(source).toContain('stress:fixture:tokens');
    expect(source).toContain('stress:http:smoke');
    expect(source).toContain('stress:http:baseline');
    expect(source).toContain('stress:http:score-cohort');
    expect(source).toContain('k6 bounded write mix');
    expect(source).toContain("STRESS_ENABLE_WRITE_MIX: 'true'");
    expect(source).toContain('stress:realtime:smoke');
    expect(source).toContain('stress:fixture:reset');
    expect(source).toContain('AUTH_THROTTLE_LIMIT=5000');
  });

  it('writes a sanitized report and removes raw .tmp artifacts', () => {
    expect(source).toContain('.omx/reports/api-dockerized-stress-result-');
    expect(source).toContain('bounded-write-mix');
    expect(source).toContain('cleanupRawArtifacts');
    expect(source).toContain('[REDACTED_STRESS_SECRET]');
    expect(source).not.toContain('console.log(metricsToken)');
  });

  it('exposes a Phase 9-2 production-like evidence profile with observability and DB readout', () => {
    expect(productionLikeSource).toContain("STRESS_DOCKER_PROFILE = 'production-like'");
    expect(source).toContain('api-production-like-stress-result-');
    expect(source).toContain('docker-compose.api.override.example.yml');
    expect(source).toContain('observability compose up');
    expect(source).toContain('prometheus api up query');
    expect(source).toContain(
      "STRESS_COHORT_SIZE: process.env.STRESS_COHORT_SIZE || (productionLikeRun ? '946'",
    );
    expect(source).toContain('stress marker residue after reset');
    expect(source).toContain('#247: 237/946 production-like cohort');
  });

  it('keeps package scripts explicit for smoke and production-like evidence runs', () => {
    expect(packageJson.scripts?.['stress:docker:smoke']).toBe(
      'node test/stress/docker/run-dockerized-smoke.mjs',
    );
    expect(packageJson.scripts?.['stress:docker:production-like']).toBe(
      'node test/stress/docker/run-production-like-evidence.mjs',
    );
  });
});
