import { z } from 'zod';

/**
 * Fixed origin of the backoffice (README §3): the operator opens
 * `http://localhost:4300` through an SSM port forward. The WebAuthn RP ID and the expected
 * origin are code constants, not env values, because changing them re-registers every passkey.
 */
export const BACKOFFICE_ORIGIN = 'http://localhost:4300';
export const BACKOFFICE_WEBAUTHN_RP_ID = 'localhost';
export const BACKOFFICE_WEBAUTHN_RP_NAME = 'dormduri backoffice';

export const BACKOFFICE_SETTINGS = Symbol('BACKOFFICE_SETTINGS');

const booleanFlag = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const databaseUrl = z
  .string()
  .min(1)
  .refine((value) => /^postgres(?:ql)?:\/\//u.test(value), 'must be a postgresql:// URL');

// 32 random bytes, base64 encoded (TOTP encryption key, README §6).
const encryptionKey = z
  .string()
  .min(1)
  .transform((value, context) => {
    const key = Buffer.from(value, 'base64');
    if (key.length !== 32) {
      context.addIssue({ code: 'custom', message: 'must be 32 bytes encoded as base64' });
      return z.NEVER;
    }
    return key;
  });

const backofficeEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    BACKOFFICE_API_PORT: z.coerce.number().int().min(1).max(65_535).default(4310),
    BACKOFFICE_DATABASE_URL: databaseUrl,
    BACKOFFICE_RETENTION_DATABASE_URL: databaseUrl,
    BACKOFFICE_DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
    BACKOFFICE_RETENTION_DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(4).default(1),
    BACKOFFICE_TOTP_ENCRYPTION_KEY: encryptionKey,
    BACKOFFICE_METRICS_BEARER_TOKEN: z.string().min(32).optional(),
    BACKOFFICE_RETENTION_JOB_ENABLED: booleanFlag.optional(),
    BACKOFFICE_RETENTION_JOB_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(60_000)
      .max(86_400_000)
      .default(3_600_000),
    BACKOFFICE_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === 'production' && !env.BACKOFFICE_METRICS_BEARER_TOKEN) {
      context.addIssue({
        code: 'custom',
        path: ['BACKOFFICE_METRICS_BEARER_TOKEN'],
        message: 'is required in production',
      });
    }
    if (env.BACKOFFICE_DATABASE_URL === env.BACKOFFICE_RETENTION_DATABASE_URL) {
      // The cleanup job must use its own LOGIN user (dormduri_backoffice_retention, README §1).
      context.addIssue({
        code: 'custom',
        path: ['BACKOFFICE_RETENTION_DATABASE_URL'],
        message: 'must differ from BACKOFFICE_DATABASE_URL',
      });
    }
  });

export interface BackofficeSettings {
  readonly env: 'development' | 'test' | 'production';
  readonly port: number;
  readonly database: {
    readonly runtimeUrl: string;
    readonly retentionUrl: string;
    readonly runtimePoolMax: number;
    readonly retentionPoolMax: number;
  };
  readonly totpEncryptionKey: Buffer;
  readonly metricsBearerToken: string | null;
  readonly retentionJob: { readonly enabled: boolean; readonly intervalMs: number };
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class BackofficeSettingsError extends Error {
  constructor(readonly fields: readonly string[]) {
    super(`backoffice settings rejected: ${fields.join(', ')}`);
    this.name = 'BackofficeSettingsError';
  }
}

/** Parses the process env. The error names the fields only, never their values. */
export function loadBackofficeSettings(env: NodeJS.ProcessEnv): BackofficeSettings {
  const parsed = backofficeEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new BackofficeSettingsError(
      parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`),
    );
  }
  const value = parsed.data;
  return {
    env: value.NODE_ENV,
    port: value.BACKOFFICE_API_PORT,
    database: {
      runtimeUrl: value.BACKOFFICE_DATABASE_URL,
      retentionUrl: value.BACKOFFICE_RETENTION_DATABASE_URL,
      runtimePoolMax: value.BACKOFFICE_DATABASE_POOL_MAX,
      retentionPoolMax: value.BACKOFFICE_RETENTION_DATABASE_POOL_MAX,
    },
    totpEncryptionKey: value.BACKOFFICE_TOTP_ENCRYPTION_KEY,
    metricsBearerToken: value.BACKOFFICE_METRICS_BEARER_TOKEN ?? null,
    retentionJob: {
      enabled: value.BACKOFFICE_RETENTION_JOB_ENABLED ?? value.NODE_ENV === 'production',
      intervalMs: value.BACKOFFICE_RETENTION_JOB_INTERVAL_MS,
    },
    logLevel: value.BACKOFFICE_LOG_LEVEL,
  };
}
