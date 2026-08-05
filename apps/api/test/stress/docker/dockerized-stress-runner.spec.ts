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
const authPasswordCapacitySource = readFileSync(
  resolve(process.cwd(), 'test/stress/docker/run-auth-password-capacity.mjs'),
  'utf8',
);
const localAuthPasswordRehearsalSource = readFileSync(
  resolve(process.cwd(), 'test/stress/docker/run-local-auth-password-rehearsal.mjs'),
  'utf8',
);
const localRehearsalCapacitySource = readFileSync(
  resolve(process.cwd(), 'test/stress/docker/local-rehearsal-capacity.mjs'),
  'utf8',
);
const localEnvSource = readFileSync(
  resolve(process.cwd(), 'test/stress/docker/local-stress-env-files.mjs'),
  'utf8',
);
const redactionSource = readFileSync(
  resolve(process.cwd(), 'test/stress/evidence/stress-evidence-redaction.mjs'),
  'utf8',
);
const reportRendererSource = readFileSync(
  resolve(process.cwd(), 'test/stress/evidence/renderers/docker-stress-report.mjs'),
  'utf8',
);
const rampDecisionSource = readFileSync(
  resolve(
    process.cwd(),
    'test/stress/decisions/roommate-search-capacity/run-237-ramp-decision.mjs',
  ),
  'utf8',
);
const apiResourceOverrideSource = readFileSync(
  resolve(process.cwd(), '../../infra/deploy/docker-compose.api.override.example.yml'),
  'utf8',
);
const observabilityResourceOverrideSource = readFileSync(
  resolve(process.cwd(), '../../infra/observability/docker-compose.observability.rehearsal.yml'),
  'utf8',
);
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
  readonly scripts?: Record<string, string>;
};

describe('dockerized stress smoke runner', () => {
  it('keeps Phase 9-1 docker API/nginx smoke steps executable from one script', () => {
    expect(source).toContain('docker-compose.api.yml');
    expect(source).toContain("'--accept-data-loss'");
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
    expect(localEnvSource).toContain("['AUTH_THROTTLE_LIMIT', () => '5000']");
    expect(localEnvSource).toContain("['AUTH_LOGIN_BURST_LIMIT', () => '5000']");
    expect(localEnvSource).toContain("['AUTH_LOGIN_SUSTAINED_LIMIT', () => '5000']");
  });

  it('writes a sanitized report and removes raw .tmp artifacts', () => {
    expect(source).toContain('.omx/reports/api-dockerized-stress-result-');
    expect(source).toContain("captureGit('status', ['--porcelain'])");
    expect(reportRendererSource).toContain('bounded-write-mix');
    expect(source).toContain('cleanupRawArtifacts');
    expect(redactionSource).toContain('[REDACTED_STRESS_SECRET]');
    expect(source).not.toContain('console.log(metricsToken)');
  });

  it('exposes a Phase 9-2 production-like evidence profile with observability and DB readout', () => {
    expect(productionLikeSource).toContain("STRESS_DOCKER_PROFILE = 'production-like'");
    expect(source).toContain('api-production-like-stress-result-');
    expect(source).toContain('docker-compose.api.override.example.yml');
    expect(source).toContain('observability compose up');
    expect(reportRendererSource).toContain('prometheus api up query');
    expect(source).toContain(
      "STRESS_COHORT_SIZE: process.env.STRESS_COHORT_SIZE || (productionLikeRun ? '946'",
    );
    expect(source).toContain('stress marker residue after reset');
    expect(reportRendererSource).not.toContain('## Issue decision notes');
  });

  it('exposes a production-like Argon2id endpoint-mix capacity runner', () => {
    expect(authPasswordCapacitySource).toContain("STRESS_DOCKER_PROFILE = 'production-like'");
    expect(authPasswordCapacitySource).toContain("STRESS_DOCKER_AUTH_PASSWORD_CAPACITY = 'true'");
    expect(source).toContain('api-auth-password-capacity-result-');
    expect(source).toContain('stress:fixture:auth-capacity');
    expect(source).toContain('stress:http:auth-password-capacity');
    expect(source).toContain('stress:report:auth-password-capacity');
    expect(source).toContain("STRESS_ACTOR_TOKENS_PATH: ''");
    expect(source).toContain('STRESS_AUTH_CAPACITY_SMOKE_MIX');
    expect(source).toContain('auth password capacity fixture reset');
  });

  it('rejects unconstrained Docker engines before recording local capacity evidence', () => {
    expect(localRehearsalCapacitySource).toContain('DEFAULT_TARGET_CPUS = 2');
    expect(localRehearsalCapacitySource).toContain('DEFAULT_TARGET_MEMORY_MIB = 4096');
    expect(localRehearsalCapacitySource).not.toContain('STRESS_LOCAL_REHEARSAL_TARGET');
    expect(source).toContain('assessCurrentDockerEngine');
    expect(source).toContain('resource-limited observability stack을 포함해야 해요');
    expect(source).toContain('stress failure를 warning으로 낮출 수 없어요');
    expect(reportRendererSource).toContain('local constrained 4GB/2CPU');
    expect(reportRendererSource).toContain('not a constrained local rehearsal');
  });

  it('runs named auth capacity profiles sequentially without custom rate overrides', () => {
    expect(localAuthPasswordRehearsalSource).toContain(
      "['h1', 'h2', 'h3', 'h7', 'h4', 'h5', 'h6', 'h9', 'h8']",
    );
    expect(localAuthPasswordRehearsalSource).toContain("'stress:local:preflight'");
    expect(localAuthPasswordRehearsalSource).toContain('STRESS_DOCKER_LOCAL_REHEARSAL');
    expect(localAuthPasswordRehearsalSource).toContain('STRESS_AUTH_CAPACITY_RATE');
    expect(localAuthPasswordRehearsalSource).toContain('I_UNDERSTAND_60_MINUTES');
    expect(localAuthPasswordRehearsalSource).toContain('authProfileEnvironment(profile)');
    expect(localAuthPasswordRehearsalSource).toContain("STRESS_API_AUTH_LOGIN_BURST_LIMIT: '30'");
    expect(localAuthPasswordRehearsalSource).toContain("STRESS_API_HTTP_TRUST_PROXY_HOPS: '2'");
    expect(apiResourceOverrideSource).toContain('STRESS_API_AUTH_LOGIN_BURST_LIMIT:-5000');
    expect(apiResourceOverrideSource).toContain('STRESS_API_HTTP_TRUST_PROXY_HOPS:-0');
    expect(source).toContain('captureH9AuthSecurityEventSnapshot');
    expect(source).toContain("'LOGIN_FAILURE'");
    expect(source).toContain("'LOGIN_LOCKOUT'");
  });

  it('keeps API, nginx, and observability resource budgets executable in compose', () => {
    expect(apiResourceOverrideSource).toContain("cpus: '1.50'");
    expect(apiResourceOverrideSource).toContain('memory: 1536M');
    expect(apiResourceOverrideSource).toContain("cpus: '0.20'");
    expect(apiResourceOverrideSource).toContain('memory: 96M');
    expect(observabilityResourceOverrideSource).toContain("cpus: '0.35'");
    expect(observabilityResourceOverrideSource).toContain('memory: 320M');
    expect(observabilityResourceOverrideSource).toContain("cpus: '0.10'");
    expect(observabilityResourceOverrideSource).toContain('memory: 160M');
    expect(source).toContain('docker-compose.observability.rehearsal.yml');
  });

  it('exposes a Phase 9-3 237 cohort ramp decision runner', () => {
    expect(rampDecisionSource).toContain('api-237-ramp-decision-result-');
    expect(rampDecisionSource).toContain("STRESS_COHORT_SIZE: '237'");
    expect(rampDecisionSource).toContain("STRESS_LARGEST_COHORT_SIZE: '237'");
    expect(rampDecisionSource).toContain(
      "STRESS_TOKEN_ACTOR_LIMIT: process.env.STRESS_TOKEN_ACTOR_LIMIT || '50'",
    );
    expect(rampDecisionSource).toContain('vus: 25');
    expect(rampDecisionSource).toContain('vus: 50');
    expect(rampDecisionSource).toContain('vus: 100');
    expect(rampDecisionSource).toContain('vus: 237');
    expect(rampDecisionSource).toContain('score p95 >= 300ms or score p99 >= 1500ms');
    expect(rampDecisionSource).toContain('p95 reached 500ms stop gate');
    expect(rampDecisionSource).toContain('escalate #247 bounded cache design');
    expect(rampDecisionSource).toContain('STRESS_DOCKER_SKIP_WRITE_MIX');
    expect(rampDecisionSource).toContain('STRESS_DOCKER_SKIP_REALTIME_SMOKE');
    expect(rampDecisionSource).toContain('STRESS_DOCKER_CONTINUE_ON_STRESS_FAILURE');
    expect(source).toContain('continueOnStressFailure');
  });

  it('keeps package scripts explicit for smoke and production-like evidence runs', () => {
    expect(packageJson.scripts?.['stress:docker:smoke']).toBe(
      'node test/stress/docker/run-dockerized-smoke.mjs',
    );
    expect(packageJson.scripts?.['stress:docker:production-like']).toBe(
      'node test/stress/docker/run-production-like-evidence.mjs',
    );
    expect(packageJson.scripts?.['stress:docker:237-ramp']).toBe(
      'node test/stress/decisions/roommate-search-capacity/run-237-ramp-decision.mjs',
    );
    expect(packageJson.scripts?.['stress:docker:auth-password-capacity']).toBe(
      'node test/stress/docker/run-auth-password-capacity.mjs',
    );
    expect(packageJson.scripts?.['stress:auth:hash-micro']).toContain(
      'run-auth-password-hash-micro.ts',
    );
    expect(packageJson.scripts?.['stress:local:preflight']).toBe(
      'node test/stress/docker/local-rehearsal-capacity.mjs',
    );
    expect(packageJson.scripts?.['stress:local:auth-password']).toBe(
      'node test/stress/docker/run-local-auth-password-rehearsal.mjs',
    );
  });
});
