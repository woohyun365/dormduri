import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function readStressEnvValue(envPath, key) {
  if (!existsSync(envPath)) return '';
  const match = readFileSync(envPath, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'mu'));
  return match?.[1]?.trim() || '';
}

export function readOrCreateMetricsToken(envPath) {
  return readStressEnvValue(envPath, 'METRICS_BEARER_TOKEN') || randomSecret();
}

export function createLocalStressEnvFiles(options) {
  function ensureLocalApiEnvFile() {
    if (existsSync(options.localEnvFile)) return ensureExistingApiEnvKeys();
    const token = options.metricsToken || randomSecret();
    writeFileSync(
      options.localEnvFile,
      [
        '# Local dockerized stress smoke env. Do not commit.',
        'NODE_ENV=production',
        'PORT=4000',
        'TZ=Asia/Seoul',
        `DATABASE_URL=${options.containerDatabaseUrl}`,
        `DIRECT_URL=${options.containerDatabaseUrl}`,
        `MIGRATION_DATABASE_URL=${options.containerDatabaseUrl}`,
        `RETENTION_WORKER_DATABASE_URL=${options.containerDatabaseUrl}`,
        `RETENTION_DISCLOSURE_DATABASE_URL=${options.containerDatabaseUrl}`,
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
    const text = readFileSync(options.localEnvFile, 'utf8');
    const candidates = [
      ['RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64', () => randomBase64Secret()],
      ['RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64', () => randomBase64Secret()],
      ['AUTH_PERSISTENCE_HMAC_SECRET', () => randomSecret()],
      ['AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64', () => randomBase64Secret()],
      ['AUTH_MAIL_ENVELOPE_KEY_VERSION', () => 'stress-v1'],
      ['AUTH_THROTTLE_LIMIT', () => '5000'],
      ['AUTH_LOGIN_BURST_LIMIT', () => '5000'],
      ['AUTH_LOGIN_SUSTAINED_LIMIT', () => '5000'],
      ['EMAIL_PROVIDER', () => 'ses'],
      ['SES_REGION', () => 'ap-northeast-2'],
      ['SES_FROM_EMAIL', () => 'no-reply@stress.invalid'],
      ['TZ', () => 'Asia/Seoul'],
    ];
    const missingLines = candidates
      .filter(([key]) => !new RegExp(`^${key}=`, 'mu').test(text))
      .map(([key, value]) => `${key}=${value()}`);
    if (missingLines.length === 0) return 'reused';
    writeFileSync(
      options.localEnvFile,
      `${text.replace(/\n?$/u, '\n')}\n# Added by dockerized stress smoke runner.\n${missingLines.join('\n')}\n`,
      { mode: 0o600 },
    );
    return 'updated';
  }

  function ensureObservabilityLocalFiles() {
    mkdirSync(dirname(options.observabilityMetricsTokenFile), { recursive: true });
    writeFileSync(options.observabilityMetricsTokenFile, `${options.metricsToken}\n`, {
      mode: 0o600,
    });
    const required = {
      OBSERVABILITY_ENV: 'local',
      OBSERVABILITY_NETWORK: options.observabilityNetwork,
      OBSERVABILITY_TZ: 'KST-9',
      API_METRICS_TARGET: 'api:4000',
      API_METRICS_SCHEME: 'http',
      API_METRICS_BEARER_TOKEN_FILE: './prometheus/secrets/api-metrics-bearer-token.local',
      GRAFANA_ADMIN_USER: 'admin',
      GRAFANA_ADMIN_PASSWORD: 'change-me-local-only',
      GF_DATE_FORMATS_DEFAULT_TIMEZONE: 'Asia/Seoul',
      GRAFANA_PORT: '3001',
      PROMETHEUS_PORT: '9090',
      LOKI_PORT: '3100',
      ALLOY_PORT: '12345',
      PROMETHEUS_RETENTION: '15d',
    };
    if (!existsSync(options.observabilityEnvFile)) {
      writeFileSync(
        options.observabilityEnvFile,
        [
          '# Local production-like stress observability env. Do not commit.',
          ...Object.entries(required).map(([key, value]) => `${key}=${value}`),
          '',
        ].join('\n'),
        { mode: 0o600 },
      );
      return 'created';
    }
    const current = readFileSync(options.observabilityEnvFile, 'utf8');
    const missing = Object.entries(required)
      .filter(([key]) => !new RegExp(`^${key}=`, 'mu').test(current))
      .map(([key, value]) => `${key}=${value}`);
    if (missing.length === 0) return 'reused';
    writeFileSync(
      options.observabilityEnvFile,
      `${current.replace(/\n?$/u, '\n')}\n# Added by dockerized stress smoke runner.\n${missing.join('\n')}\n`,
      { mode: 0o600 },
    );
    return 'updated';
  }

  return { ensureLocalApiEnvFile, ensureObservabilityLocalFiles };
}

function randomSecret() {
  return randomBytes(32).toString('hex');
}
function randomBase64Secret() {
  return randomBytes(32).toString('base64');
}
