import { describe, expect, it } from 'vitest';
import { CHAT_THREAD_LIST_CURSOR_HMAC_SECRET_ENV } from '../chat/queries/chat-thread-list-cursor.js';
import {
  PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET_ENV,
  ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV,
} from '../roommate-search/pagination/roommate-search-token.codec.js';
import { DEFAULT_LOG_HASH_SECRET } from './observability.config.js';
import { SECRET_NAME_PREFIX_ENV } from './secrets/secret-name-prefix.constants.js';
import { envValidationSchema } from './env.validation.js';

const validBase64Key = Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');

function productionEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://api:password@db.internal:5432/api',
    DIRECT_URL: 'postgresql://migration:password@db.internal:5432/api',
    RETENTION_WORKER_DATABASE_URL: 'postgresql://retention_worker:password@db.internal:5432/api',
    RETENTION_DISCLOSURE_DATABASE_URL:
      'postgresql://retention_disclosure:password@db.internal:5432/api',
    MIGRATION_DATABASE_URL: 'postgresql://migration:password@db.internal:5432/api',
    LOG_HASH_SECRET: 'production-log-hash-secret',
    METRICS_BEARER_TOKEN: 'production-metrics-token',
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

function errorPaths(env: Record<string, string | undefined>): string[] {
  const { error } = envValidationSchema.validate(env, { abortEarly: false });
  return error?.details.map((detail) => detail.path.join('.')) ?? [];
}

describe('envValidationSchema', () => {
  it('keeps local/test safe defaults available', () => {
    const result = envValidationSchema.validate({ NODE_ENV: 'test' }, { abortEarly: false });
    const value = result.value as unknown as Record<string, unknown>;

    expect(result.error).toBeUndefined();
    expect(value).toMatchObject({
      NODE_ENV: 'test',
      EMAIL_PROVIDER: 'stub',
      SECRET_SOURCE: 'env',
      HTTP_TRUST_PROXY: false,
      HTTP_COOKIE_SECURE: false,
      HTTP_COOKIE_SAME_SITE: 'lax',
    });
  });

  it('accepts a complete production baseline', () => {
    const { error } = envValidationSchema.validate(productionEnv(), { abortEarly: false });

    expect(error).toBeUndefined();
  });

  it('requires critical production secrets', () => {
    expect(errorPaths(productionEnv({ LOG_HASH_SECRET: undefined }))).toContain('LOG_HASH_SECRET');
    expect(errorPaths(productionEnv({ METRICS_BEARER_TOKEN: undefined }))).toContain(
      'METRICS_BEARER_TOKEN',
    );
    expect(errorPaths(productionEnv({ VERIFICATION_CODE_HMAC_SECRET: undefined }))).toContain(
      'VERIFICATION_CODE_HMAC_SECRET',
    );
  });

  it('rejects production placeholders and local default secret values', () => {
    expect(
      errorPaths(productionEnv({ DATABASE_URL: 'postgresql://api:REPLACE_ME@db/api' })),
    ).toContain('DATABASE_URL');
    expect(
      errorPaths(productionEnv({ DATABASE_URL: 'postgresql://api:password@localhost/api' })),
    ).toContain('DATABASE_URL');
    expect(errorPaths(productionEnv({ LOG_HASH_SECRET: DEFAULT_LOG_HASH_SECRET }))).toContain(
      'LOG_HASH_SECRET',
    );
    expect(
      errorPaths(
        productionEnv({ [ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV]: 'local-cursor-secret' }),
      ),
    ).toContain(ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV);
  });

  it('requires explicit SES email provider selection in production', () => {
    expect(errorPaths(productionEnv({ EMAIL_PROVIDER: undefined }))).toContain('EMAIL_PROVIDER');
    expect(errorPaths(productionEnv({ EMAIL_PROVIDER: 'stub' }))).toContain('EMAIL_PROVIDER');
  });

  it('requires SES region and sender when SES is selected', () => {
    expect(errorPaths(productionEnv({ SES_REGION: undefined }))).toContain('SES_REGION');
    expect(errorPaths(productionEnv({ SES_FROM_EMAIL: undefined }))).toContain('SES_FROM_EMAIL');
  });

  it('allows only supported secret sources', () => {
    expect(
      errorPaths(
        productionEnv({
          SECRET_SOURCE: 'aws-secrets-manager',
          [SECRET_NAME_PREFIX_ENV]: '/knu-roommate/production/api',
        }),
      ),
    ).toEqual([]);
    expect(errorPaths(productionEnv({ SECRET_SOURCE: 'local-file' }))).toContain('SECRET_SOURCE');
  });

  it('requires a Secrets Manager name prefix when production selects aws-secrets-manager', () => {
    expect(errorPaths(productionEnv({ SECRET_SOURCE: 'aws-secrets-manager' }))).toContain(
      SECRET_NAME_PREFIX_ENV,
    );
    expect(
      errorPaths(
        productionEnv({
          SECRET_SOURCE: 'aws-secrets-manager',
          [SECRET_NAME_PREFIX_ENV]: 'knu-roommate/production/api',
        }),
      ),
    ).toContain(SECRET_NAME_PREFIX_ENV);
    expect(
      errorPaths(
        productionEnv({
          SECRET_SOURCE: 'aws-secrets-manager',
          [SECRET_NAME_PREFIX_ENV]: '/knu-roommate/production/api',
        }),
      ),
    ).toEqual([]);
  });

  it('validates cookie SameSite values', () => {
    expect(errorPaths(productionEnv({ HTTP_COOKIE_SAME_SITE: 'none' }))).toEqual([]);
    expect(errorPaths(productionEnv({ HTTP_COOKIE_SAME_SITE: 'cross-site' }))).toContain(
      'HTTP_COOKIE_SAME_SITE',
    );
  });
});
