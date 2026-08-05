#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assessCurrentDockerEngine,
  formatLocalRehearsalGuidance,
} from './local-rehearsal-capacity.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(scriptDir, '../../..');
const repoRoot = resolve(apiRoot, '../..');
const deployDir = resolve(repoRoot, 'infra/deploy');
const observabilityDir = resolve(repoRoot, 'infra/observability');
const composeFile = resolve(deployDir, 'docker-compose.api.yml');
const composeObservabilityOverrideFile = resolve(
  deployDir,
  'docker-compose.api.override.example.yml',
);
const observabilityComposeFile = resolve(observabilityDir, 'docker-compose.observability.yml');
const observabilityRehearsalOverrideFile = resolve(
  observabilityDir,
  'docker-compose.observability.rehearsal.yml',
);
const observabilityEnvFile = resolve(observabilityDir, '.env.observability');
const observabilityMetricsTokenFile = resolve(
  observabilityDir,
  'prometheus/secrets/api-metrics-bearer-token.local',
);
const localEnvFile = resolve(deployDir, '.env.api');
const reportsDir = resolve(apiRoot, 'test/stress/reports');
const runProfile =
  process.env.STRESS_DOCKER_PROFILE === 'production-like' ? 'production-like' : 'smoke';
const productionLikeRun = runProfile === 'production-like';
const useObservability = productionLikeRun && process.env.STRESS_DOCKER_OBSERVABILITY !== 'false';
const skipBuild = process.env.STRESS_DOCKER_SKIP_BUILD === 'true';
const skipWriteMix = process.env.STRESS_DOCKER_SKIP_WRITE_MIX === 'true';
const skipRealtimeSmoke = process.env.STRESS_DOCKER_SKIP_REALTIME_SMOKE === 'true';
const continueOnStressFailure = process.env.STRESS_DOCKER_CONTINUE_ON_STRESS_FAILURE === 'true';
const authPasswordCapacityRun = process.env.STRESS_DOCKER_AUTH_PASSWORD_CAPACITY === 'true';
const authPasswordCapacityProfile = process.env.STRESS_AUTH_CAPACITY_PROFILE || 'h1';
const localRehearsalRun = process.env.STRESS_DOCKER_LOCAL_REHEARSAL === 'true';
const targetUrl = process.env.STRESS_TARGET_URL || 'http://127.0.0.1:8080';
const dockerProjectName = process.env.STRESS_DOCKER_COMPOSE_PROJECT || 'knu-roommate-api';
const observabilityProjectName =
  process.env.STRESS_OBSERVABILITY_COMPOSE_PROJECT || 'knu-roommate-observability';
const observabilityNetwork = process.env.OBSERVABILITY_NETWORK || 'knu-roommate-observability';
const postgresContainerName =
  process.env.STRESS_POSTGRES_CONTAINER_NAME || 'knu-roommate-postgres-dev';
const localDatabaseUrl =
  process.env.STRESS_LOCAL_DATABASE_URL ||
  'postgresql://knu_dev:knu_dev_password@localhost:5432/knu_roommate?schema=public';
const containerDatabaseUrl =
  process.env.STRESS_CONTAINER_DATABASE_URL ||
  'postgresql://knu_dev:knu_dev_password@host.docker.internal:5432/knu_roommate?schema=public';
const metricsToken = process.env.STRESS_DOCKER_METRICS_TOKEN || readMetricsToken(localEnvFile);
const timestamp = new Date().toISOString().replace(/[:.]/gu, '-');
const runId =
  process.env.STRESS_DOCKER_RUN_ID ||
  (authPasswordCapacityRun
    ? `auth-password-capacity-${timestamp}`
    : productionLikeRun
      ? `production-like-${timestamp}`
      : `docker-smoke-${timestamp}`);
const reportPath = resolve(
  repoRoot,
  process.env.STRESS_DOCKER_REPORT_PATH ||
    (authPasswordCapacityRun
      ? `.omx/reports/api-auth-password-capacity-result-${timestamp}.md`
      : productionLikeRun
        ? `.omx/reports/api-production-like-stress-result-${timestamp}.md`
        : `.omx/reports/api-dockerized-stress-result-${timestamp}.md`),
);
const actorTokenPath = resolve(reportsDir, `.tmp-${runId}-actor-tokens.json`);
const k6SmokeSummaryPath = resolve(reportsDir, `.tmp-${runId}-k6-smoke-summary.json`);
const k6BaselineSummaryPath = resolve(reportsDir, `.tmp-${runId}-k6-baseline-summary.json`);
const k6AuthLoginSummaryPath = resolve(reportsDir, `.tmp-${runId}-k6-auth-login-summary.json`);
const authPasswordCapacityArtifactPath = resolve(
  reportsDir,
  `.tmp-${runId}-auth-password-capacity.json`,
);
const k6AuthPasswordCapacitySummaryPath = resolve(
  reportsDir,
  `.tmp-${runId}-k6-auth-password-capacity-summary.json`,
);
const authPasswordCapacityDecisionPath = resolve(
  reportsDir,
  `.tmp-${runId}-auth-password-capacity-decision.json`,
);
const k6ScoreSummaryPath = resolve(reportsDir, `.tmp-${runId}-k6-score-summary.json`);
const k6WriteSummaryPath = resolve(reportsDir, `.tmp-${runId}-k6-write-summary.json`);
const artillerySummaryPath = resolve(reportsDir, `.tmp-${runId}-artillery-summary.json`);
const artilleryActorCsvPath = resolve(reportsDir, `.tmp-${runId}-artillery-actors.csv`);
const commandResults = [];
let runError = null;
const evidence = {
  localRehearsalCapacity: null,
  health: null,
  readiness: null,
  metricsUnauthorized: null,
  metricsAuthorized: null,
  dockerPs: '',
  dockerStats: '',
  dockerResourceLimits: '',
  observabilityPs: '',
  observabilityReadiness: null,
  prometheusApiUp: null,
  postgresBefore: '',
  h9AuthSecurityEvents: '',
  postgresAfter: '',
  markerResidue: '',
  k6Smoke: null,
  k6Baseline: null,
  k6AuthLogin: null,
  k6AuthPasswordCapacity: null,
  authPasswordCapacityDecision: null,
  k6Score: null,
  k6Write: null,
  artillerySmoke: null,
  dockerLogs: '',
};

mkdirSync(reportsDir, { recursive: true });

try {
  if (localRehearsalRun) {
    assertLocalRehearsalInputs();
    evidence.localRehearsalCapacity = assessCurrentDockerEngine();
    const passed = evidence.localRehearsalCapacity.status === 'passed';
    commandResults.push({
      name: 'local rehearsal Docker capacity',
      status: passed ? 'pass' : 'fail',
      note: passed
        ? `${evidence.localRehearsalCapacity.actualCpus} CPU / ${evidence.localRehearsalCapacity.actualMemoryMiB}MiB`
        : evidence.localRehearsalCapacity.failures.join(' '),
    });
    if (!passed) {
      throw new Error(formatLocalRehearsalGuidance(evidence.localRehearsalCapacity));
    }
  }

  const envFileStatus = ensureLocalApiEnvFile();
  commandResults.push({
    name: 'prepare .env.api',
    status: 'pass',
    note: `${envFileStatus} private env file`,
  });

  runRequired('docker compose dev postgres up', [
    'docker',
    'compose',
    '-f',
    'docker-compose.dev.yml',
    'up',
    '-d',
    'postgres',
  ]);
  runRequired('prisma generate', ['pnpm', '--dir', 'apps/api', 'prisma:generate']);
  runRequired(
    'prisma db push',
    [
      'pnpm',
      '--dir',
      'apps/api',
      'exec',
      'prisma',
      'db',
      'push',
      '--schema',
      'prisma/schema.prisma',
      '--accept-data-loss',
    ],
    { env: buildHostDbEnv() },
  );
  if (useObservability) {
    const observabilityStatus = ensureObservabilityLocalFiles();
    commandResults.push({
      name: 'prepare observability env',
      status: 'pass',
      note: `${observabilityStatus} private observability env/token`,
    });
    runRequired('observability compose config', buildObservabilityComposeArgs('config'), {
      env: buildObservabilityEnv(),
      quiet: true,
      note: 'observability compose config validated without printing rendered env',
    });
    runRequired('observability compose up', buildObservabilityComposeArgs('up', '-d'), {
      env: buildObservabilityEnv(),
    });
  }

  runRequired('api compose config', buildApiComposeArgs('config'), {
    quiet: true,
    note: composeConfigNote(),
  });
  if (skipBuild) {
    commandResults.push({
      name: 'api compose build',
      status: 'pass',
      note: 'skipped by STRESS_DOCKER_SKIP_BUILD=true',
    });
  } else {
    runRequired('api compose build', buildApiComposeArgs('build', 'api'));
  }
  runRequired('api compose up', buildApiComposeArgs('up', '-d'));

  evidence.health = await waitForHttp(`${targetUrl}/health`, {
    name: 'health',
    expectedStatuses: [200],
  });
  evidence.readiness = await waitForHttp(`${targetUrl}/health/ready`, {
    name: 'readiness',
    expectedStatuses: [200],
  });
  evidence.metricsUnauthorized = await fetchStatus(`${targetUrl}/internal/metrics`);
  commandResults.push({
    name: 'metrics unauthorized check',
    status: evidence.metricsUnauthorized.status === 401 ? 'pass' : 'fail',
    note: `http ${evidence.metricsUnauthorized.status}`,
  });
  evidence.metricsAuthorized = await fetchStatus(`${targetUrl}/internal/metrics`, {
    headers: { Authorization: `Bearer ${metricsToken}` },
  });
  commandResults.push({
    name: 'metrics authorized check',
    status: evidence.metricsAuthorized.status === 200 ? 'pass' : 'fail',
    note: `http ${evidence.metricsAuthorized.status}, bytes ${evidence.metricsAuthorized.bodyLength}`,
  });

  const stressEnv = buildStressEnv();
  evidence.postgresBefore = capturePostgresSnapshot('postgres snapshot before stress', stressEnv);
  runRequired('stress fixture seed', ['pnpm', '--dir', 'apps/api', 'stress:fixture:seed'], {
    env: stressEnv,
  });
  if (authPasswordCapacityRun) {
    runRequired(
      'auth password capacity fixture',
      ['pnpm', '--dir', 'apps/api', 'stress:fixture:auth-capacity'],
      { env: stressEnv },
    );
    runStressCommand(
      'k6 auth password capacity',
      ['pnpm', '--dir', 'apps/api', 'stress:http:auth-password-capacity'],
      {
        env: {
          ...stressEnv,
          STRESS_ACTOR_TOKENS_PATH: '',
          STRESS_AUTH_CAPACITY_PROFILE: authPasswordCapacityProfile,
          STRESS_AUTH_CAPACITY_DURATION: process.env.STRESS_AUTH_CAPACITY_DURATION,
          STRESS_AUTH_CAPACITY_RATE: process.env.STRESS_AUTH_CAPACITY_RATE,
          STRESS_AUTH_CAPACITY_SMOKE_MIX:
            process.env.STRESS_AUTH_CAPACITY_SMOKE_MIX ||
            (process.env.STRESS_AUTH_CAPACITY_DURATION && process.env.STRESS_AUTH_CAPACITY_RATE
              ? 'true'
              : 'false'),
          STRESS_K6_SUMMARY_PATH: k6AuthPasswordCapacitySummaryPath,
        },
      },
    );
    evidence.k6AuthPasswordCapacity = parseJsonArtifact(k6AuthPasswordCapacitySummaryPath);
    runRequired(
      'auth password capacity decision',
      [
        'pnpm',
        '--dir',
        'apps/api',
        'stress:report:auth-password-capacity',
        k6AuthPasswordCapacitySummaryPath,
        authPasswordCapacityDecisionPath,
        authPasswordCapacityProfile,
      ],
      { env: stressEnv },
    );
    evidence.authPasswordCapacityDecision = parseJsonArtifact(authPasswordCapacityDecisionPath);
  } else {
    runRequired('stress fixture tokens', ['pnpm', '--dir', 'apps/api', 'stress:fixture:tokens'], {
      env: stressEnv,
    });
    runRequired('k6 smoke', ['pnpm', '--dir', 'apps/api', 'stress:http:smoke'], {
      env: {
        ...stressEnv,
        STRESS_SMOKE_DURATION:
          process.env.STRESS_SMOKE_DURATION || (productionLikeRun ? '30s' : '10s'),
        STRESS_SMOKE_VUS: process.env.STRESS_SMOKE_VUS || (productionLikeRun ? '5' : '1'),
        STRESS_K6_SUMMARY_PATH: k6SmokeSummaryPath,
      },
    });
    evidence.k6Smoke = parseJsonArtifact(k6SmokeSummaryPath);
    runStressCommand(
      'k6 authenticated baseline',
      ['pnpm', '--dir', 'apps/api', 'stress:http:baseline'],
      {
        env: {
          ...stressEnv,
          STRESS_BASELINE_DURATION:
            process.env.STRESS_BASELINE_DURATION || (productionLikeRun ? '2m' : '10s'),
          STRESS_BASELINE_VUS: process.env.STRESS_BASELINE_VUS || (productionLikeRun ? '25' : '1'),
          STRESS_SLEEP_SECONDS: process.env.STRESS_SLEEP_SECONDS || '0.2',
          STRESS_K6_SUMMARY_PATH: k6BaselineSummaryPath,
        },
      },
    );
    evidence.k6Baseline = parseJsonArtifact(k6BaselineSummaryPath);
    runStressCommand(
      'k6 auth login capacity',
      ['pnpm', '--dir', 'apps/api', 'stress:http:auth-login'],
      {
        env: {
          ...stressEnv,
          STRESS_AUTH_ACTOR_COUNT:
            process.env.STRESS_AUTH_ACTOR_COUNT || (productionLikeRun ? '25' : '3'),
          STRESS_AUTH_LOGIN_VUS:
            process.env.STRESS_AUTH_LOGIN_VUS || (productionLikeRun ? '10' : '1'),
          STRESS_AUTH_LOGIN_DURATION:
            process.env.STRESS_AUTH_LOGIN_DURATION || (productionLikeRun ? '1m' : '10s'),
          STRESS_SLEEP_SECONDS: process.env.STRESS_SLEEP_SECONDS || '0.2',
          STRESS_K6_SUMMARY_PATH: k6AuthLoginSummaryPath,
        },
      },
    );
    evidence.k6AuthLogin = parseJsonArtifact(k6AuthLoginSummaryPath);
    runStressCommand('k6 score cohort', ['pnpm', '--dir', 'apps/api', 'stress:http:score-cohort'], {
      env: {
        ...stressEnv,
        STRESS_SCORE_COHORT_DURATION:
          process.env.STRESS_SCORE_COHORT_DURATION || (productionLikeRun ? '2m' : '10s'),
        STRESS_SCORE_COHORT_VUS:
          process.env.STRESS_SCORE_COHORT_VUS || (productionLikeRun ? '50' : '1'),
        STRESS_SLEEP_SECONDS: process.env.STRESS_SLEEP_SECONDS || '0.2',
        STRESS_K6_SUMMARY_PATH: k6ScoreSummaryPath,
      },
    });
    evidence.k6Score = parseJsonArtifact(k6ScoreSummaryPath);
    if (skipWriteMix) {
      commandResults.push({
        name: 'k6 bounded write mix',
        status: 'pass',
        note: 'skipped by STRESS_DOCKER_SKIP_WRITE_MIX=true',
      });
    } else {
      runStressCommand(
        'k6 bounded write mix',
        ['pnpm', '--dir', 'apps/api', 'stress:http:baseline'],
        {
          env: {
            ...stressEnv,
            STRESS_BASELINE_DURATION:
              process.env.STRESS_WRITE_MIX_DURATION || (productionLikeRun ? '1m' : '10s'),
            STRESS_BASELINE_VUS:
              process.env.STRESS_WRITE_MIX_VUS || (productionLikeRun ? '10' : '1'),
            STRESS_SLEEP_SECONDS: process.env.STRESS_SLEEP_SECONDS || '0.2',
            STRESS_ENABLE_WRITE_MIX: 'true',
            STRESS_K6_SUMMARY_PATH: k6WriteSummaryPath,
          },
        },
      );
      evidence.k6Write = parseJsonArtifact(k6WriteSummaryPath);
    }
    if (skipRealtimeSmoke) {
      commandResults.push({
        name: 'artillery realtime smoke',
        status: 'pass',
        note: 'skipped by STRESS_DOCKER_SKIP_REALTIME_SMOKE=true',
      });
    } else {
      runOptional(
        'artillery realtime smoke',
        ['pnpm', '--dir', 'apps/api', 'stress:realtime:smoke'],
        {
          env: {
            ...stressEnv,
            STRESS_ARTILLERY_SUMMARY_PATH: artillerySummaryPath,
            STRESS_ARTILLERY_ACTOR_CSV_PATH: artilleryActorCsvPath,
            STRESS_REALTIME_SOCKET_URL: `${targetUrl.replace(/\/$/u, '')}/chat`,
            STRESS_REALTIME_ORIGIN: new URL(targetUrl).origin,
          },
        },
      );
      evidence.artillerySmoke = existsSync(artillerySummaryPath)
        ? parseJsonArtifact(artillerySummaryPath)
        : null;
    }
  }
  if (useObservability) {
    evidence.observabilityReadiness = await fetchStatus('http://127.0.0.1:9090/-/ready');
    evidence.prometheusApiUp = await fetchStatus(
      'http://127.0.0.1:9090/api/v1/query?query=up%7Bjob%3D%22api%22%7D',
    );
  }
} catch (error) {
  runError = error;
  commandResults.push({
    name: 'runner exception',
    status: 'fail',
    note: error instanceof Error ? redact(error.message) : redact(String(error)),
  });
} finally {
  evidence.dockerPs = capture('docker compose ps', buildApiComposeArgs('ps'));
  evidence.dockerStats = capture('docker stats snapshot', [
    'docker',
    'stats',
    '--no-stream',
    '--format',
    'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}',
    `${dockerProjectName}-api-1`,
    `${dockerProjectName}-nginx-1`,
    postgresContainerName,
    ...(useObservability
      ? [
          `${observabilityProjectName}-prometheus-1`,
          `${observabilityProjectName}-grafana-1`,
          `${observabilityProjectName}-loki-1`,
          `${observabilityProjectName}-alloy-1`,
          `${observabilityProjectName}-alertmanager-1`,
        ]
      : []),
  ]);
  evidence.dockerResourceLimits = localRehearsalRun
    ? capture('docker resource limits', [
        'docker',
        'inspect',
        '--format',
        '{{.Name}} cpu={{.HostConfig.NanoCpus}} memory={{.HostConfig.Memory}}',
        `${dockerProjectName}-api-1`,
        `${dockerProjectName}-nginx-1`,
        `${observabilityProjectName}-prometheus-1`,
        `${observabilityProjectName}-grafana-1`,
        `${observabilityProjectName}-loki-1`,
        `${observabilityProjectName}-alloy-1`,
        `${observabilityProjectName}-alertmanager-1`,
      ])
    : '';
  evidence.observabilityPs = useObservability
    ? capture('observability compose ps', buildObservabilityComposeArgs('ps'), {
        env: buildObservabilityEnv(),
      })
    : '';
  evidence.dockerLogs = capture(
    'docker compose logs',
    buildApiComposeArgs('logs', '--no-color', '--tail=160', 'api', 'nginx'),
  );

  if (authPasswordCapacityRun && authPasswordCapacityProfile.toLowerCase() === 'h9') {
    evidence.h9AuthSecurityEvents = captureH9AuthSecurityEventSnapshot(buildStressEnv());
  }

  if (authPasswordCapacityRun) {
    runOptional(
      'auth password capacity fixture reset',
      ['pnpm', '--dir', 'apps/api', 'stress:fixture:auth-capacity:reset'],
      { env: buildStressEnv() },
    );
  }

  try {
    runOptional('stress fixture reset', ['pnpm', '--dir', 'apps/api', 'stress:fixture:reset'], {
      env: buildStressEnv(),
    });
  } catch {
    // runOptional already records failures; keep cleanup best-effort.
  }
  evidence.postgresAfter = capturePostgresSnapshot(
    'postgres snapshot after reset',
    buildStressEnv(),
  );
  evidence.markerResidue = captureMarkerResidue(
    'stress marker residue after reset',
    buildStressEnv(),
  );

  if (process.env.STRESS_DOCKER_KEEP_UP !== 'true') {
    runOptional('api compose down', buildApiComposeArgs('down'));
    if (useObservability) {
      runOptional('observability compose down', buildObservabilityComposeArgs('down'), {
        env: buildObservabilityEnv(),
      });
    }
  }

  writeReport();
  cleanupRawArtifacts();
}

const failed = commandResults.filter((result) => result.status === 'fail');
console.log(
  `${productionLikeRun ? 'Production-like docker stress' : 'Dockerized stress smoke'} report: ${reportPath}`,
);
if (runError) {
  console.error(runError instanceof Error ? runError.message : String(runError));
}
process.exit(failed.length === 0 ? 0 : 1);

function ensureLocalApiEnvFile() {
  if (existsSync(localEnvFile)) {
    return ensureExistingApiEnvKeys();
  }

  const token = metricsToken || randomSecret();
  writeFileSync(
    localEnvFile,
    [
      '# Local dockerized stress smoke env. Do not commit.',
      'NODE_ENV=production',
      'PORT=4000',
      'TZ=Asia/Seoul',
      `DATABASE_URL=${containerDatabaseUrl}`,
      `DIRECT_URL=${containerDatabaseUrl}`,
      `MIGRATION_DATABASE_URL=${containerDatabaseUrl}`,
      `RETENTION_WORKER_DATABASE_URL=${containerDatabaseUrl}`,
      `RETENTION_DISCLOSURE_DATABASE_URL=${containerDatabaseUrl}`,
      'DATABASE_POOL_MAX=10',
      'DATABASE_POOL_MIN=0',
      'DATABASE_ADAPTER_CONNECT_TIMEOUT_MS=5000',
      'DATABASE_ADAPTER_IDLE_TIMEOUT_MS=300000',
      `LOG_HASH_SECRET=${randomSecret()}`,
      `RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64=${randomBase64Secret()}`,
      `RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64=${randomBase64Secret()}`,
      'METRICS_ENABLED=true',
      `METRICS_BEARER_TOKEN=${token}`,
      'AUTH_THROTTLE_LIMIT=5000',
      'AUTH_LOGIN_BURST_LIMIT=5000',
      'AUTH_LOGIN_SUSTAINED_LIMIT=5000',
      `VERIFICATION_CODE_HMAC_SECRET=${randomSecret()}`,
      `AUTH_PERSISTENCE_HMAC_SECRET=${randomSecret()}`,
      `AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64=${randomBase64Secret()}`,
      'AUTH_MAIL_ENVELOPE_KEY_VERSION=stress-v1',
      'EMAIL_PROVIDER=ses',
      'SES_REGION=ap-northeast-2',
      'SES_FROM_EMAIL=no-reply@stress.invalid',
      `ROOMMATE_SEARCH_CURSOR_HMAC_SECRET=${randomSecret()}`,
      `PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET=${randomSecret()}`,
      `CHAT_THREAD_LIST_CURSOR_HMAC_SECRET=${randomSecret()}`,
      'LOG_LEVEL=info',
      'LOG_PRETTY=false',
      'OBSERVABILITY_SERVICE_NAME=api',
      'CHAT_REALTIME_ALLOWED_ORIGINS=http://127.0.0.1:8080,http://localhost:8080',
      'CHAT_REALTIME_TRUST_PROXY=true',
      'LIFECYCLE_SWEEP_ENABLED=false',
      'API_IMAGE_TAG=phase9-1-local',
      'NGINX_HTTP_BIND=127.0.0.1',
      'NGINX_HTTP_PORT=8080',
      '',
    ].join('\n'),
    { mode: 0o600 },
  );
  return 'created';
}

function ensureExistingApiEnvKeys() {
  const text = readFileSync(localEnvFile, 'utf8');
  const missingLines = [];
  if (!/^RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64=/mu.test(text)) {
    missingLines.push(`RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64=${randomBase64Secret()}`);
  }
  if (!/^RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64=/mu.test(text)) {
    missingLines.push(`RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64=${randomBase64Secret()}`);
  }
  if (!/^AUTH_PERSISTENCE_HMAC_SECRET=/mu.test(text)) {
    missingLines.push(`AUTH_PERSISTENCE_HMAC_SECRET=${randomSecret()}`);
  }
  if (!/^AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64=/mu.test(text)) {
    missingLines.push(`AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64=${randomBase64Secret()}`);
  }
  if (!/^AUTH_MAIL_ENVELOPE_KEY_VERSION=/mu.test(text)) {
    missingLines.push('AUTH_MAIL_ENVELOPE_KEY_VERSION=stress-v1');
  }
  if (!/^AUTH_THROTTLE_LIMIT=/mu.test(text)) {
    missingLines.push('AUTH_THROTTLE_LIMIT=5000');
  }
  if (!/^AUTH_LOGIN_BURST_LIMIT=/mu.test(text)) {
    missingLines.push('AUTH_LOGIN_BURST_LIMIT=5000');
  }
  if (!/^AUTH_LOGIN_SUSTAINED_LIMIT=/mu.test(text)) {
    missingLines.push('AUTH_LOGIN_SUSTAINED_LIMIT=5000');
  }
  if (!/^EMAIL_PROVIDER=/mu.test(text)) {
    missingLines.push('EMAIL_PROVIDER=ses');
  }
  if (!/^SES_REGION=/mu.test(text)) {
    missingLines.push('SES_REGION=ap-northeast-2');
  }
  if (!/^SES_FROM_EMAIL=/mu.test(text)) {
    missingLines.push('SES_FROM_EMAIL=no-reply@stress.invalid');
  }
  if (!/^TZ=/mu.test(text)) {
    missingLines.push('TZ=Asia/Seoul');
  }

  if (missingLines.length === 0) {
    return 'reused';
  }

  writeFileSync(
    localEnvFile,
    `${text.replace(/\n?$/u, '\n')}\n# Added by dockerized stress smoke runner.\n${missingLines.join('\n')}\n`,
    {
      mode: 0o600,
    },
  );
  return 'updated';
}

function ensureObservabilityLocalFiles() {
  mkdirSync(dirname(observabilityMetricsTokenFile), { recursive: true });
  writeFileSync(observabilityMetricsTokenFile, `${metricsToken}\n`, { mode: 0o600 });

  const envBody = [
    '# Local production-like stress observability env. Do not commit.',
    'OBSERVABILITY_ENV=local',
    `OBSERVABILITY_NETWORK=${observabilityNetwork}`,
    'OBSERVABILITY_TZ=KST-9',
    'API_METRICS_TARGET=api:4000',
    'API_METRICS_SCHEME=http',
    'API_METRICS_BEARER_TOKEN_FILE=./prometheus/secrets/api-metrics-bearer-token.local',
    'GRAFANA_ADMIN_USER=admin',
    'GRAFANA_ADMIN_PASSWORD=change-me-local-only',
    'GF_DATE_FORMATS_DEFAULT_TIMEZONE=Asia/Seoul',
    'GRAFANA_PORT=3001',
    'PROMETHEUS_PORT=9090',
    'LOKI_PORT=3100',
    'ALLOY_PORT=12345',
    'PROMETHEUS_RETENTION=15d',
    '',
  ].join('\n');

  if (!existsSync(observabilityEnvFile)) {
    writeFileSync(observabilityEnvFile, envBody, { mode: 0o600 });
    return 'created';
  }

  const current = readFileSync(observabilityEnvFile, 'utf8');
  const missingLines = [];
  if (!/^OBSERVABILITY_TZ=/mu.test(current)) {
    missingLines.push('OBSERVABILITY_TZ=KST-9');
  }
  if (!/^GF_DATE_FORMATS_DEFAULT_TIMEZONE=/mu.test(current)) {
    missingLines.push('GF_DATE_FORMATS_DEFAULT_TIMEZONE=Asia/Seoul');
  }
  if (missingLines.length === 0) {
    return 'reused';
  }

  writeFileSync(
    observabilityEnvFile,
    `${current.replace(/\n?$/u, '\n')}\n# Added by dockerized stress smoke runner.\n${missingLines.join('\n')}\n`,
    { mode: 0o600 },
  );
  return 'updated';
}

function readEnvValue(envPath, key) {
  if (!existsSync(envPath)) {
    return '';
  }

  const envText = readFileSync(envPath, 'utf8');
  const match = envText.match(new RegExp(`^${key}=(.*)$`, 'mu'));
  return match?.[1]?.trim() || '';
}

function readMetricsToken(envPath) {
  if (!existsSync(envPath)) {
    return randomSecret();
  }

  const envText = readFileSync(envPath, 'utf8');
  const match = envText.match(/^METRICS_BEARER_TOKEN=(.*)$/mu);
  return match?.[1]?.trim() || randomSecret();
}

function randomSecret() {
  return randomBytes(32).toString('hex');
}

function randomBase64Secret() {
  return randomBytes(32).toString('base64');
}

function buildHostDbEnv() {
  return {
    ...process.env,
    NODE_ENV: 'development',
    DATABASE_URL: localDatabaseUrl,
    DIRECT_URL: localDatabaseUrl,
    MIGRATION_DATABASE_URL: localDatabaseUrl,
    RETENTION_WORKER_DATABASE_URL: localDatabaseUrl,
    RETENTION_DISCLOSURE_DATABASE_URL: localDatabaseUrl,
  };
}

function buildStressEnv() {
  return {
    ...buildHostDbEnv(),
    STRESS_TARGET_URL: targetUrl,
    STRESS_ENV: 'local',
    STRESS_ALLOWED_HOSTS: 'localhost,127.0.0.1,host.docker.internal',
    STRESS_FIXTURE_APPLY: 'I_UNDERSTAND_STAGING_FIXTURE',
    STRESS_FIXTURE_PREFIX:
      process.env.STRESS_FIXTURE_PREFIX ||
      (productionLikeRun ? 'production-like-stress' : 'docker-stress-smoke'),
    STRESS_SEASON_ID:
      process.env.STRESS_SEASON_ID ||
      (productionLikeRun
        ? 'production-like-stress-season-local'
        : 'docker-stress-smoke-season-local'),
    STRESS_CAMPUS_CODE: process.env.STRESS_CAMPUS_CODE || 'CHUNCHEON',
    STRESS_LARGEST_COHORT_SIZE:
      process.env.STRESS_LARGEST_COHORT_SIZE || (productionLikeRun ? '237' : '4'),
    STRESS_COHORT_SIZE: process.env.STRESS_COHORT_SIZE || (productionLikeRun ? '946' : '12'),
    STRESS_DORMITORY_COUNT: process.env.STRESS_DORMITORY_COUNT || (productionLikeRun ? '4' : '2'),
    STRESS_ROOM_TYPE: process.env.STRESS_ROOM_TYPE || '2',
    STRESS_TOKEN_ACTOR_LIMIT:
      process.env.STRESS_TOKEN_ACTOR_LIMIT || (productionLikeRun ? '25' : '3'),
    STRESS_ACTOR_TOKENS_PATH: actorTokenPath,
    STRESS_AUTH_CAPACITY_ARTIFACT_PATH: authPasswordCapacityArtifactPath,
    AUTH_PERSISTENCE_HMAC_SECRET:
      process.env.AUTH_PERSISTENCE_HMAC_SECRET ||
      readEnvValue(localEnvFile, 'AUTH_PERSISTENCE_HMAC_SECRET'),
  };
}

function buildApiComposeArgs(...extraArgs) {
  const composeFiles = [composeFile];
  if (useObservability) {
    composeFiles.push(composeObservabilityOverrideFile);
  }

  return [
    'docker',
    'compose',
    '-p',
    dockerProjectName,
    ...composeFiles.flatMap((file) => ['-f', relative(repoRoot, file)]),
    ...extraArgs,
  ];
}

function buildObservabilityComposeArgs(...extraArgs) {
  const composeFiles = [observabilityComposeFile];
  if (localRehearsalRun) {
    composeFiles.push(observabilityRehearsalOverrideFile);
  }
  return [
    'docker',
    'compose',
    '-p',
    observabilityProjectName,
    '--env-file',
    relative(repoRoot, observabilityEnvFile),
    ...composeFiles.flatMap((file) => ['-f', relative(repoRoot, file)]),
    ...extraArgs,
  ];
}

function assertLocalRehearsalInputs() {
  if (!productionLikeRun || !authPasswordCapacityRun) {
    throw new Error('Local rehearsal은 auth password capacity production-like runner만 지원해요.');
  }
  if (!useObservability) {
    throw new Error('Local rehearsal은 resource-limited observability stack을 포함해야 해요.');
  }
  if (continueOnStressFailure) {
    throw new Error('Local rehearsal은 stress failure를 warning으로 낮출 수 없어요.');
  }
  if (process.env.STRESS_AUTH_CAPACITY_RATE || process.env.STRESS_AUTH_CAPACITY_DURATION) {
    throw new Error(
      'Local rehearsal은 H1~H9 기본 rate와 duration을 사용해야 해요. override를 제거해 주세요.',
    );
  }
}

function buildObservabilityEnv() {
  return {
    ...process.env,
    OBSERVABILITY_ENV: 'local',
    OBSERVABILITY_NETWORK: observabilityNetwork,
    OBSERVABILITY_TZ: 'KST-9',
    API_METRICS_TARGET: 'api:4000',
    API_METRICS_SCHEME: 'http',
    API_METRICS_BEARER_TOKEN_FILE: './prometheus/secrets/api-metrics-bearer-token.local',
  };
}

function composeConfigNote() {
  return useObservability
    ? 'api/nginx compose config validated with observability network override without printing rendered env'
    : 'compose config validated without printing rendered env';
}

function runRequired(name, args, options = {}) {
  const result = runCommand(name, args, { ...options, required: true });
  if (result.status === 'fail') {
    throw new Error(`${name} failed`);
  }
  return result;
}

function runOptional(name, args, options = {}) {
  return runCommand(name, args, { ...options, required: false });
}

function runStressCommand(name, args, options = {}) {
  return continueOnStressFailure
    ? runOptional(name, args, {
        ...options,
        note: `${name} completed as warn-on-failure stress evidence step`,
      })
    : runRequired(name, args, options);
}

function runCommand(name, args, options = {}) {
  const [command, ...commandArgs] = args;
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    env: options.env || process.env,
    stdio: options.quiet ? 'pipe' : 'inherit',
    encoding: options.quiet ? 'utf8' : undefined,
  });
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  const rawStatus = exitCode === 0 ? 'pass' : 'fail';
  const status = options.required === false && rawStatus === 'fail' ? 'warn' : rawStatus;
  commandResults.push({
    name,
    status,
    exitCode,
    note:
      options.note ||
      (options.required === false && rawStatus === 'fail'
        ? 'best-effort command failed'
        : options.quiet
          ? redact(String(result.stdout || result.stderr || '')).slice(0, 200)
          : ''),
  });
  return { status, exitCode };
}

function capture(name, args, options = {}) {
  const [command, ...commandArgs] = args;
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    env: options.env || process.env,
    encoding: 'utf8',
  });
  commandResults.push({
    name,
    status: result.status === 0 ? 'pass' : 'fail',
    exitCode: result.status ?? 1,
    note: '',
  });
  return redact(String(result.stdout || result.stderr || '').trim());
}

function capturePostgresSnapshot(name, env) {
  const query = [
    "select 'connections', count(*)::text from pg_stat_activity",
    "select 'waiting_locks', count(*)::text from pg_locks where not granted",
    "select 'user_tables_size_mb', coalesce(round(sum(pg_total_relation_size(relid))/1024/1024)::text, '0') from pg_catalog.pg_statio_user_tables",
  ].join(' union all ');

  return capture(
    name,
    [
      'docker',
      'exec',
      postgresContainerName,
      'psql',
      '-U',
      'knu_dev',
      '-d',
      'knu_roommate',
      '-Atc',
      query,
    ],
    { env },
  );
}

function captureH9AuthSecurityEventSnapshot(env) {
  const output = capture(
    'H9 auth security event snapshot',
    [
      'docker',
      'exec',
      postgresContainerName,
      'psql',
      '-U',
      'knu_dev',
      '-d',
      'knu_roommate',
      '-Atc',
      `select "type"::text, count(*)::text from "AuthSecurityEvent" where "type" in ('LOGIN_FAILURE', 'LOGIN_LOCKOUT') group by "type" order by "type"`,
    ],
    { env },
  );
  const hasFailureEvent = /^LOGIN_FAILURE\|[1-9][0-9]*$/mu.test(output);
  const hasLockoutEvent = /^LOGIN_LOCKOUT\|[1-9][0-9]*$/mu.test(output);
  commandResults.push({
    name: 'H9 auth security event assertion',
    status: hasFailureEvent && hasLockoutEvent ? 'pass' : 'fail',
    note:
      hasFailureEvent && hasLockoutEvent
        ? 'LOGIN_FAILURE and LOGIN_LOCKOUT persisted'
        : 'required bounded event types missing',
  });
  return output;
}

function captureMarkerResidue(name, env) {
  const marker = String(env.STRESS_FIXTURE_PREFIX || 'stress-local');
  if (!/^[a-z0-9][a-z0-9-]{2,48}$/u.test(marker)) {
    commandResults.push({
      name,
      status: 'fail',
      exitCode: 2,
      note: 'invalid marker for residue query',
    });
    return '';
  }

  const likeMarker = `${marker}%`;
  const query = [
    `select 'users', count(*)::text from "User" where id like '${likeMarker}'`,
    `select 'participants', count(*)::text from "SeasonParticipant" where id like '${likeMarker}'`,
    `select 'profiles', count(*)::text from "SeasonParticipantProfile" where "participantId" like '${likeMarker}'`,
    `select 'threads', count(*)::text from "ConversationThread" where id like '${likeMarker}'`,
    `select 'messages', count(*)::text from "ConversationMessage" where "threadId" like '${likeMarker}'`,
    `select 'match_requests', count(*)::text from "MatchRequest" where id like '${likeMarker}' or "requesterParticipantId" like '${likeMarker}' or "receiverParticipantId" like '${likeMarker}'`,
    `select 'bookmarks', count(*)::text from "UserBookmark" where "viewerUserId" like '${likeMarker}' or "targetUserId" like '${likeMarker}'`,
    `select 'reports', count(*)::text from "ReportCase" where "reporterUserId" like '${likeMarker}' or "targetUserId" like '${likeMarker}'`,
    `select 'support_tickets', count(*)::text from "SupportTicket" where "requesterUserId" like '${likeMarker}'`,
  ].join(' union all ');

  return capture(
    name,
    [
      'docker',
      'exec',
      postgresContainerName,
      'psql',
      '-U',
      'knu_dev',
      '-d',
      'knu_roommate',
      '-Atc',
      query,
    ],
    { env },
  );
}

async function waitForHttp(url, { name, expectedStatuses, attempts = 60, delayMs = 1000 }) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    last = await fetchStatus(url);
    if (expectedStatuses.includes(last.status)) {
      commandResults.push({ name: `${name} check`, status: 'pass', note: `http ${last.status}` });
      return last;
    }
    await delay(delayMs);
  }

  commandResults.push({
    name: `${name} check`,
    status: 'fail',
    note: `last http ${last?.status ?? 'n/a'}`,
  });
  throw new Error(`${name} check failed for ${url}`);
}

async function fetchStatus(url, init = {}) {
  try {
    const response = await fetch(url, init);
    const text = await response.text();
    return {
      status: response.status,
      bodyLength: text.length,
      bodySample: redact(text.slice(0, 120)),
    };
  } catch (error) {
    return {
      status: 0,
      bodyLength: 0,
      bodySample: redact(error instanceof Error ? error.message : String(error)),
    };
  }
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function parseJsonArtifact(path) {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return { parseError: true };
  }
}

function writeReport() {
  mkdirSync(dirname(reportPath), { recursive: true });
  const report = [
    authPasswordCapacityRun
      ? '# API Argon2id password capacity evidence result'
      : productionLikeRun
        ? '# API production-like docker stress evidence result'
        : '# API dockerized stress smoke result',
    '',
    `- generatedAt: ${new Date().toISOString()}`,
    `- gitCommit: ${captureGit('rev-parse', ['HEAD'])}`,
    `- gitBranch: ${captureGit('branch', ['--show-current'])}`,
    `- gitDirty: ${captureGit('status', ['--porcelain']).length > 0 ? 'true' : 'false'}`,
    `- runProfile: ${runProfile}`,
    `- authPasswordCapacityProfile: ${
      authPasswordCapacityRun ? process.env.STRESS_AUTH_CAPACITY_PROFILE || 'h1' : 'disabled'
    }`,
    `- targetClass: ${
      localRehearsalRun
        ? 'local constrained 4GB/2CPU docker API/nginx/observability/PostgreSQL'
        : productionLikeRun
          ? 'local production-like docker nginx/API/PostgreSQL'
          : 'local docker API/nginx'
    }`,
    `- targetUrl: ${targetUrl}`,
    `- fixtureCohortSize: ${buildStressEnv().STRESS_COHORT_SIZE}`,
    `- fixtureLargestCohortSize: ${buildStressEnv().STRESS_LARGEST_COHORT_SIZE}`,
    `- tokenActorLimit: ${buildStressEnv().STRESS_TOKEN_ACTOR_LIMIT}`,
    `- observabilityEnabled: ${useObservability ? 'true' : 'false'}`,
    `- localRehearsal: ${localRehearsalRun ? 'true' : 'false'}`,
    `- skippedBuild: ${skipBuild ? 'true' : 'false'}`,
    `- skippedWriteMix: ${skipWriteMix ? 'true' : 'false'}`,
    `- skippedRealtimeSmoke: ${skipRealtimeSmoke ? 'true' : 'false'}`,
    `- continueOnStressFailure: ${continueOnStressFailure ? 'true' : 'false'}`,
    '- rawArtifacts: removed from ignored .tmp-* paths after report generation',
    '',
    '## Local resource boundary',
    '',
    localRehearsalRun
      ? [
          `- Docker engine: ${evidence.localRehearsalCapacity?.actualCpus ?? 'unknown'} CPU / ${evidence.localRehearsalCapacity?.actualMemoryMiB ?? 'unknown'}MiB`,
          '- API/nginx와 observability는 repository rehearsal override의 container limit을 사용했다.',
          '- Web/BackOffice runtime은 현재 compose에 포함되지 않는다. 정책 budget의 576MiB limit은 결과 해석 시 미사용 headroom으로 남긴다.',
          '- 이 결과는 local constrained evidence이며 managed PostgreSQL 또는 external host capacity를 증명하지 않는다.',
        ].join('\n')
      : '- status: not a constrained local rehearsal',
    '',
    '## Command results',
    '',
    '| Command | Status | Exit | Note |',
    '| --- | --- | ---: | --- |',
    ...commandResults.map(
      (result) =>
        `| ${escapeCell(result.name)} | ${result.status} | ${result.exitCode ?? ''} | ${escapeCell(result.note || '')} |`,
    ),
    '',
    '## HTTP boundary',
    '',
    `- health: ${formatHttp(evidence.health)}`,
    `- readiness: ${formatHttp(evidence.readiness)}`,
    `- metrics without bearer: ${formatHttp(evidence.metricsUnauthorized)} (expected 401)`,
    `- metrics with bearer: ${formatHttp(evidence.metricsAuthorized)} (expected 200; token omitted)`,
    '',
    '## Observability readout',
    '',
    useObservability
      ? [
          `- prometheus readiness: ${formatHttp(evidence.observabilityReadiness)}`,
          `- prometheus api up query: ${formatHttp(evidence.prometheusApiUp)}`,
          '- Grafana/Loki/Alloy UI endpoints are local-only; use the compose readout below for service state.',
        ].join('\n')
      : '- status: disabled for this run profile',
    '',
    '## k6 summaries',
    '',
    '| Scenario | Duration ms | http_req_duration p95 | http_req_duration p99 | http_req_failed rate | checks rate |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    renderK6Row('smoke', evidence.k6Smoke),
    renderK6Row('baseline-250', evidence.k6Baseline),
    renderK6Row('auth-login-capacity', evidence.k6AuthLogin),
    renderK6Row('auth-password-burst', evidence.k6AuthPasswordCapacity),
    renderK6Row('score-cohort-946', evidence.k6Score),
    renderK6Row('bounded-write-mix', evidence.k6Write),
    '',
    '## Auth password capacity decision',
    '',
    '```json',
    JSON.stringify(evidence.authPasswordCapacityDecision ?? { status: 'not-run' }, null, 2),
    '```',
    '',
    '## Artillery summary',
    '',
    renderArtillerySummary(evidence.artillerySmoke),
    '',
    '## Docker readout',
    '',
    '```txt',
    evidence.dockerPs || '(not captured)',
    '',
    evidence.observabilityPs || '(observability not enabled)',
    '',
    evidence.dockerStats || '(not captured)',
    '```',
    '',
    '## Docker resource limits',
    '',
    '```txt',
    evidence.dockerResourceLimits || '(not collected)',
    '```',
    '',
    '## PostgreSQL readout',
    '',
    '```txt',
    evidence.postgresBefore || '(before snapshot not captured)',
    '',
    evidence.h9AuthSecurityEvents
      ? `h9_auth_security_events\n${evidence.h9AuthSecurityEvents}`
      : '(H9 auth security event snapshot not applicable)',
    '',
    evidence.postgresAfter || '(after snapshot not captured)',
    '',
    evidence.markerResidue || '(marker residue not captured)',
    '```',
    '',
    '## Docker logs tail',
    '',
    '```txt',
    evidence.dockerLogs || '(not captured)',
    '```',
    '',
    '## Issue decision notes',
    '',
    '- #204/#205: local L2 smoke에서 Redis 도입 여부를 확정하지 않는다. authenticated read/write가 실행 가능하다는 smoke evidence만 남긴다.',
    productionLikeRun
      ? '- #247: 237/946 production-like cohort 결과를 기준으로 roommate-search score cache 승격 여부를 판단한다. local pg container 결과는 RDS 최종 판단 전 provisional evidence다.'
      : '- #247: score-cohort는 local 12명 smoke로 script correctness만 검증했다. 237/946 production-like cohort 수치가 없으므로 cache 도입은 보류/후속 측정이다.',
    '- #250/#254/#255: realtime은 smoke만 실행했다. baseline/peak와 multi-node/limiter/alert threshold는 one-time ticket per VU 전략과 staging evidence가 필요하다.',
    productionLikeRun
      ? '- #256/#272: local pg container DB snapshot과 latency를 함께 남기되, RDS IOPS/EXPLAIN 또는 MatchHistory rebuild 정책은 staging/RDS metric이 추가될 때 확정한다.'
      : '- #256/#272: local docker DB 수치만으로 RDS IOPS/EXPLAIN 또는 MatchHistory rebuild 정책을 바꾸지 않는다. staging/RDS metric이 필요하다.',
    '- #22/#280: dockerized smoke command, metrics boundary, sanitized report 흐름은 운영 대응 evidence 수집 루프에 연결된다.',
    '',
    '## Safety',
    '',
    '- raw token/ticket/cookie/password/email/DB URL/webhook 값은 이 report에 기록하지 않았다.',
    '- fixture reset은 marker prefix 기반 best-effort cleanup으로 실행했다.',
    '- `.env.api`는 local private file이며 커밋 대상이 아니다.',
    '',
  ].join('\n');

  writeFileSync(reportPath, redact(report), { mode: 0o600 });
}

function captureGit(command, args) {
  const result = spawnSync('git', [command, ...args], { cwd: repoRoot, encoding: 'utf8' });
  return String(result.stdout || '').trim();
}

function formatHttp(result) {
  if (!result) {
    return 'not captured';
  }
  return `http ${result.status}, bytes ${result.bodyLength}`;
}

function renderK6Row(name, summary) {
  const metric =
    summary?.metrics?.http_req_duration?.values ?? summary?.metrics?.http_req_duration ?? {};
  const failed =
    summary?.metrics?.http_req_failed?.values ?? summary?.metrics?.http_req_failed ?? {};
  const checks = summary?.metrics?.checks?.values ?? summary?.metrics?.checks ?? {};
  return [
    name,
    summary?.state?.testRunDurationMs ?? '',
    metric['p(95)'] ?? metric.p95 ?? '',
    metric['p(99)'] ?? metric.p99 ?? '',
    failed.rate ?? failed.value ?? '',
    checks.rate ?? checks.value ?? '',
  ]
    .map((value) => escapeCell(String(value)))
    .join(' | ')
    .replace(/^/u, '| ')
    .replace(/$/u, ' |');
}

function renderArtillerySummary(summary) {
  if (!summary) {
    return '- status: skipped or no artifact';
  }
  const aggregate = summary.aggregate ?? summary;
  const counters = aggregate.counters ?? {};
  const summaries = aggregate.summaries ?? aggregate.histograms ?? {};
  return [
    `- vusers.created: ${counters['vusers.created'] ?? ''}`,
    `- vusers.completed: ${counters['vusers.completed'] ?? ''}`,
    `- vusers.failed: ${counters['vusers.failed'] ?? ''}`,
    `- socketio.response_time.p95: ${summaries['socketio.response_time']?.p95 ?? ''}`,
    `- subscribeAck.p95: ${summaries['stress.realtime.subscribe_ack_ms']?.p95 ?? ''}`,
  ].join('\n');
}

function cleanupRawArtifacts() {
  for (const artifactPath of [
    actorTokenPath,
    k6SmokeSummaryPath,
    k6BaselineSummaryPath,
    k6AuthLoginSummaryPath,
    authPasswordCapacityArtifactPath,
    k6AuthPasswordCapacitySummaryPath,
    authPasswordCapacityDecisionPath,
    k6ScoreSummaryPath,
    k6WriteSummaryPath,
    artillerySummaryPath,
    artilleryActorCsvPath,
  ]) {
    if (existsSync(artifactPath)) {
      rmSync(artifactPath, { force: true });
    }
  }
}

function escapeCell(value) {
  return redact(value).replace(/\|/gu, '\\|').replace(/\n/gu, '<br>');
}

function redact(value) {
  return String(value)
    .replace(/postgresql:\/\/[^\s)]+/giu, 'postgresql://[REDACTED_STRESS_SECRET]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer [REDACTED_STRESS_SECRET]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, '[REDACTED_STRESS_SECRET]')
    .replace(/(TOKEN|SECRET|PASSWORD|DATABASE_URL)=([^\s]+)/giu, '$1=[REDACTED_STRESS_SECRET]');
}
