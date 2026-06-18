import { afterEach, describe, expect, it } from 'vitest';
import observabilityConfig from './observability.config.js';
import { envValidationSchema } from './env.validation.js';
import { CHAT_THREAD_LIST_CURSOR_HMAC_SECRET_ENV } from '../chat/queries/chat-thread-list-cursor.js';
import {
  PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET_ENV,
  ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV,
} from '../roommate-search/pagination/roommate-search-token.codec.js';

const originalEnv = { ...process.env };
const validBase64Key = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');

function resetEnv() {
  process.env = { ...originalEnv };
}

function productionEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://api:password@db.internal:5432/api',
    DIRECT_URL: 'postgresql://api:password@db.internal:5432/api',
    RETENTION_WORKER_DATABASE_URL: 'postgresql://api:password@db.internal:5432/api',
    RETENTION_DISCLOSURE_DATABASE_URL: 'postgresql://api:password@db.internal:5432/api',
    MIGRATION_DATABASE_URL: 'postgresql://api:password@db.internal:5432/api',
    LOG_HASH_SECRET: 'production-log-hash-secret',
    VERIFICATION_CODE_HMAC_SECRET: 'production-verification-secret',
    RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64: validBase64Key,
    RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64: validBase64Key,
    [ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV]: 'production-roommate-search-secret',
    [PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET_ENV]: 'production-profile-detail-secret',
    [CHAT_THREAD_LIST_CURSOR_HMAC_SECRET_ENV]: 'production-chat-thread-list-secret',
    EMAIL_PROVIDER: 'ses',
    SES_REGION: 'ap-northeast-2',
    SES_FROM_EMAIL: 'no-reply@example.com',
    ...overrides,
  };
}

describe('observabilityConfig', () => {
  afterEach(() => {
    resetEnv();
  });

  it('keeps metrics scrape open only when local/test token is unset', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.METRICS_BEARER_TOKEN;

    expect(observabilityConfig()).toMatchObject({
      env: 'test',
      metricsEnabled: true,
      metricsBearerToken: null,
    });
  });

  it('reads the configured metrics bearer token without exposing it as a metric label', () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_BEARER_TOKEN = 'metrics-secret';

    expect(observabilityConfig()).toMatchObject({
      env: 'production',
      metricsEnabled: true,
      metricsBearerToken: 'metrics-secret',
      metricsRoute: 'internal/metrics',
      metricsHttpDurationBuckets: [0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 2, 5],
    });
  });

  it('requires METRICS_BEARER_TOKEN in production env validation', () => {
    const { error } = envValidationSchema.validate(productionEnv(), { abortEarly: false });

    expect(error?.details.map((detail) => detail.path.join('.'))).toContain('METRICS_BEARER_TOKEN');
  });

  it('accepts METRICS_BEARER_TOKEN in production env validation', () => {
    const { error } = envValidationSchema.validate(
      productionEnv({ METRICS_BEARER_TOKEN: 'metrics-secret' }),
      { abortEarly: false },
    );

    expect(error).toBeUndefined();
  });
});
