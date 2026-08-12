import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_ENV_KEYS } from '../../../src/config/environment/env-key.registry.js';
import { envValidationSchema } from '../../../src/config/environment/env.validation.js';

const apiRoot = process.cwd();
const sourceRoot = join(apiRoot, 'src');
const configRoot = join(sourceRoot, 'config');

const envKeyInventory = [
  'NODE_ENV',
  'PORT',
  'TZ',
  'DATABASE_URL',
  'DIRECT_URL',
  'MIGRATION_DATABASE_URL',
  'RETENTION_WORKER_DATABASE_URL',
  'RETENTION_DISCLOSURE_DATABASE_URL',
  'DATABASE_ADAPTER_CONNECT_TIMEOUT_MS',
  'DATABASE_ADAPTER_IDLE_TIMEOUT_MS',
  'DATABASE_POOL_MAX',
  'DATABASE_POOL_MIN',
  'DATABASE_QUERY_TIMEOUT_MS',
  'DATABASE_STATEMENT_TIMEOUT_MS',
  'DATABASE_APPLICATION_NAME',
  'RETENTION_WORKER_DATABASE_APPLICATION_NAME',
  'RETENTION_DISCLOSURE_DATABASE_APPLICATION_NAME',
  'PRISMA_QUERY_LOG_EVENTS',
  'OBSERVABILITY_SERVICE_NAME',
  'LOG_LEVEL',
  'LOG_HASH_SECRET',
  'LOG_PRETTY',
  'METRICS_ENABLED',
  'METRICS_BEARER_TOKEN',
  'VERIFICATION_CODE_HMAC_SECRET',
  'AUTH_PERSISTENCE_HMAC_SECRET',
  'AUTH_PERSISTENCE_HMAC_KEY_VERSION',
  'AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64',
  'AUTH_MAIL_ENVELOPE_KEY_VERSION',
  'AUTH_MAIL_DISPATCHER_ENABLED',
  'AUTH_MAIL_DISPATCHER_INTERVAL_MS',
  'AUTH_MAIL_DISPATCHER_BATCH_SIZE',
  'AUTH_MAIL_DISPATCHER_CLAIM_LEASE_MS',
  'AUTH_MAIL_SEND_TIMEOUT_MS',
  'CODE_REQUEST_COOLDOWN_SECONDS',
  'CODE_REQUEST_BACKSTOP_WINDOW_SECONDS',
  'CODE_REQUEST_BACKSTOP_LIMIT',
  'AUTH_THROTTLE_LIMIT',
  'AUTH_LOGIN_BURST_LIMIT',
  'AUTH_LOGIN_BURST_WINDOW_SECONDS',
  'AUTH_LOGIN_SUSTAINED_LIMIT',
  'AUTH_LOGIN_SUSTAINED_WINDOW_SECONDS',
  'AUTH_CHANGE_PASSWORD_LIMIT',
  'AUTH_CHANGE_PASSWORD_WINDOW_SECONDS',
  'AUTH_RENEWAL_PREVIOUS_TOKEN_GRACE_ENABLED',
  'AUTH_PASSWORD_HASH_CONCURRENCY',
  'AUTH_PASSWORD_HASH_QUEUE_LIMIT',
  'AUTH_PASSWORD_HASH_WAIT_TIMEOUT_MS',
  'AUTH_CLEANUP_BATCH_SIZE',
  'AUTH_EXPIRED_SESSION_RETENTION_DAYS',
  'AUTH_VERIFICATION_CODE_RETENTION_DAYS',
  'AUTH_VERIFICATION_REQUEST_LOG_RETENTION_DAYS',
  'AUTH_LOGIN_ATTEMPT_RETENTION_DAYS',
  'AUTH_SECURITY_EVENT_RETENTION_DAYS',
  'EMAIL_PROVIDER',
  'SES_REGION',
  'SES_FROM_EMAIL',
  'SES_FROM_NAME',
  'SES_REPLY_TO_EMAIL',
  'SES_CONFIGURATION_SET',
  'HTTP_TRUST_PROXY_HOPS',
  'HTTP_TRUST_PROXY_CIDRS',
  'HTTP_CORS_ALLOWED_ORIGINS',
  'HTTP_COOKIE_SECURE',
  'HTTP_COOKIE_SAME_SITE',
  'HTTP_COOKIE_DOMAIN',
  'CHAT_REALTIME_ALLOWED_ORIGINS',
  'CHAT_REALTIME_TRUST_PROXY',
  'CHAT_REALTIME_DISPATCHER_ENABLED',
  'CHAT_REALTIME_DISPATCHER_INTERVAL_MS',
  'CHAT_REALTIME_DISPATCHER_BATCH_SIZE',
  'CHAT_REALTIME_DISPATCHER_CLAIM_LEASE_MS',
  'CHAT_REALTIME_DISPATCHER_RETRY_BASE_MS',
  'CHAT_REALTIME_DISPATCHER_RETRY_MAX_MS',
  'CHAT_REALTIME_MESSAGE_USER_LIMIT',
  'CHAT_REALTIME_MESSAGE_USER_WINDOW_SECONDS',
  'CHAT_REALTIME_MESSAGE_PAIR_LIMIT',
  'CHAT_REALTIME_MESSAGE_PAIR_WINDOW_SECONDS',
  'CHAT_REALTIME_MESSAGE_BURST_LIMIT',
  'CHAT_REALTIME_MESSAGE_BURST_WINDOW_SECONDS',
  'CHAT_REALTIME_TICKET_USER_LIMIT',
  'CHAT_REALTIME_TICKET_USER_WINDOW_SECONDS',
  'CHAT_REALTIME_TICKET_IP_LIMIT',
  'CHAT_REALTIME_TICKET_IP_WINDOW_SECONDS',
  'CHAT_REALTIME_WS_CONNECT_IP_LIMIT',
  'CHAT_REALTIME_WS_CONNECT_IP_WINDOW_SECONDS',
  'CHAT_REALTIME_WS_CONNECT_USER_LIMIT',
  'CHAT_REALTIME_WS_CONNECT_USER_WINDOW_SECONDS',
  'CHAT_REALTIME_WS_CONCURRENT_USER_LIMIT',
  'CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_LIMIT',
  'CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_WINDOW_SECONDS',
  'CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_LIMIT',
  'CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_WINDOW_SECONDS',
  'LIFECYCLE_SWEEP_ENABLED',
  'LIFECYCLE_SWEEP_INTERVAL_MS',
  'RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64',
  'RETENTION_IDENTITY_KEY_VERSION',
  'RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64',
  'RETENTION_VAULT_CHAT_BODY_KEY_VERSION',
  'ROOMMATE_SEARCH_CURSOR_HMAC_SECRET',
  'PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET',
  'CHAT_THREAD_LIST_CURSOR_HMAC_SECRET',
  'SECRET_SOURCE',
  'SECRET_NAME_PREFIX',
] as const;

const configFactoryBaseline = {
  'app.config': {
    owner: 'platform/runtime',
    path: 'src/platform/runtime/app.config.ts',
    consumers: [
      'src/config/composition/api-config.registry.ts',
      'src/health/checks/email-provider-health.check.ts',
      'src/health/checks/secret-source-health.check.ts',
      'src/platform/observability/observability.config.ts',
      'src/platform/runtime/app.env.ts',
      'src/platform/runtime/bootstrap/prepare-runtime-environment.ts',
    ],
  },
  'auth-operations.config': {
    owner: 'auth/operations',
    path: 'src/auth/operations/config/auth-operations.config.ts',
    consumers: [
      'src/auth/operations/cleanup/auth-operational-cleanup.service.ts',
      'src/auth/operations/config/auth-operations.env.ts',
      'src/config/composition/api-config.registry.ts',
    ],
  },
  'auth.config': {
    owner: 'auth',
    path: 'src/auth/config/auth.config.ts',
    consumers: [
      'src/auth/auth.module.ts',
      'src/auth/config/auth.env.ts',
      'src/auth/credentials/change-password-admission.service.ts',
      'src/auth/credentials/password-hashing/password-hash-admission.service.ts',
      'src/auth/login-attempts/network-throttle/auth-throttle.options.ts',
      'src/auth/mail/auth-mail-dispatcher.service.ts',
      'src/auth/mail/auth-mail-envelope-reader.service.ts',
      'src/auth/mail/auth-mail-envelope-writer.service.ts',
      'src/auth/security-events/auth-security-event.service.ts',
      'src/auth/sessions/renew-session.command.ts',
      'src/auth/verification/auth-verification.service.ts',
      'src/config/composition/api-config.registry.ts',
    ],
  },
  'chat-realtime.config': {
    owner: 'chat/realtime',
    path: 'src/chat/realtime/chat-realtime.config.ts',
    consumers: [
      'src/chat/composition/chat.providers.ts',
      'src/chat/realtime/chat-realtime-allow-request-limiter.ts',
      'src/chat/realtime/chat-realtime-rate-limiter.service.ts',
      'src/chat/realtime/chat-realtime.env.ts',
      'src/chat/realtime/chat-realtime.gateway.ts',
      'src/config/composition/api-config.registry.ts',
    ],
  },
  'database.config': {
    owner: 'platform/database',
    path: 'src/platform/database/database.config.ts',
    consumers: [
      'src/config/composition/api-config.registry.ts',
      'src/platform/database/database.env.ts',
      'src/platform/database/prisma.service.ts',
    ],
  },
  'email.config': {
    owner: 'auth/adapters/email',
    path: 'src/auth/adapters/email/email.config.ts',
    consumers: [
      'src/auth/adapters/email/email-sender.provider.ts',
      'src/auth/adapters/email/email.env.ts',
      'src/auth/adapters/email/ses-email-sender.service.ts',
      'src/auth/composition/auth.providers.ts',
      'src/config/composition/api-config.registry.ts',
      'src/health/checks/email-provider-health.check.ts',
    ],
  },
  'http.config': {
    owner: 'platform/http',
    path: 'src/platform/http/http.config.ts',
    consumers: [
      'src/config/composition/api-config.registry.ts',
      'src/platform/http/http-cookie-policy.ts',
      'src/platform/http/http-runtime.ts',
      'src/platform/http/http.env.ts',
    ],
  },
  'lifecycle.config': {
    owner: 'lifecycle',
    path: 'src/lifecycle/config/lifecycle.config.ts',
    consumers: [
      'src/config/composition/api-config.registry.ts',
      'src/lifecycle/config/lifecycle.env.ts',
      'src/lifecycle/lifecycle-sweep.service.ts',
    ],
  },
  'observability.config': {
    owner: 'platform/observability',
    path: 'src/platform/observability/observability.config.ts',
    consumers: [
      'src/config/composition/api-config.registry.ts',
      'src/platform/observability/logging/app-logger.service.ts',
      'src/platform/observability/logging/request-context.service.ts',
      'src/platform/observability/metrics/domain-prometheus-metrics.service.ts',
      'src/platform/observability/metrics/http-metrics.service.ts',
      'src/platform/observability/metrics/metrics-auth.guard.ts',
      'src/platform/observability/metrics/metrics.controller.ts',
      'src/platform/observability/metrics/prisma-pool-metrics.service.ts',
      'src/platform/observability/metrics/prometheus-registry.service.ts',
      'src/platform/observability/observability.env.ts',
    ],
  },
  'secret-source.config': {
    owner: 'platform/runtime',
    path: 'src/platform/runtime/secret-source.config.ts',
    consumers: [
      'src/config/composition/api-config.registry.ts',
      'src/config/secrets/secret-inventory.ts',
      'src/config/secrets/secret-materializer.ts',
      'src/health/checks/secret-source-health.check.ts',
      'src/platform/runtime/bootstrap/prepare-runtime-environment.ts',
      'src/platform/runtime/bootstrap/runtime-bootstrap-receipt.ts',
      'src/platform/runtime/secret-source.env.ts',
    ],
  },
} as const;

describe('API configuration ownership boundary', () => {
  it('keeps validation schema and deployment metadata on the same key inventory', () => {
    const schemaDescription = envValidationSchema.describe() as {
      keys?: Record<string, unknown>;
    };
    const schemaKeys = Object.keys(schemaDescription.keys ?? {}).sort();
    const metadataKeys = ALL_ENV_KEYS.map(({ key }) => key).sort();

    expect(schemaKeys).toEqual([...envKeyInventory].sort());
    expect(metadataKeys).toEqual([...envKeyInventory].sort());
  });

  it('keeps config factories with their actual owners and records production consumers', () => {
    for (const [factoryName, baseline] of Object.entries(configFactoryBaseline)) {
      expect(baseline.owner.length).toBeGreaterThan(0);
      expect(existsSync(join(apiRoot, baseline.path))).toBe(true);
      expect(findFactoryConsumers(factoryName)).toEqual([...baseline.consumers].sort());
    }
  });

  it('keeps the config root free from product-domain config definitions', () => {
    const rootConfigFiles = readdirSync(configRoot)
      .filter((name) => name.endsWith('.config.ts') || name.endsWith('.env.ts'))
      .sort();

    expect(rootConfigFiles).toEqual([]);
    expect(existsSync(join(configRoot, 'schema'))).toBe(false);
    expect(existsSync(join(configRoot, 'env-keys'))).toBe(false);
  });

  it('composes config factories, validation, and env metadata through one registry', () => {
    expect(existsSync(join(configRoot, 'composition/api-config.registry.ts'))).toBe(true);
  });
});

function findFactoryConsumers(factoryName: string): string[] {
  const importPattern = new RegExp(
    `from\\s+['"][^'"]*${escapeRegExp(factoryName)}(?:\\.js)?['"]`,
    'u',
  );

  return walkTypeScriptFiles(sourceRoot)
    .filter((path) => !path.endsWith('.spec.ts'))
    .filter((path) => importPattern.test(readFileSync(path, 'utf8')))
    .map((path) => relative(apiRoot, path).replaceAll('\\', '/'))
    .sort();
}

function walkTypeScriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return walkTypeScriptFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
