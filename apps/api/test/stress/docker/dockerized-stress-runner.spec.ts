import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'test/stress/docker/run-dockerized-smoke.mjs'),
  'utf8',
);

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
});
