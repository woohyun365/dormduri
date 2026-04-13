const NODE_ENV = process.env.NODE_ENV ?? 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/knu_roommate?schema=public';
const DEFAULT_PORT = 4000;
const DEFAULT_JWT_SECRET = 'local-jwt-secret';
const DEFAULT_CODE_REQUEST_COOLDOWN_SECONDS = IS_PRODUCTION ? 30 : 5;
const DEFAULT_CODE_REQUEST_BACKSTOP_WINDOW_SECONDS = 60 * 10;
const DEFAULT_CODE_REQUEST_BACKSTOP_LIMIT = IS_PRODUCTION ? 5 : 20;
const DEFAULT_AUTH_THROTTLE_LIMIT = IS_PRODUCTION ? 60 : 300;

function readStringEnv(
  key: string,
  fallback?: string,
  options?: { requiredInProduction?: boolean },
): string {
  const raw = process.env[key]?.trim();
  if (raw) {
    return raw;
  }

  if (IS_PRODUCTION && options?.requiredInProduction) {
    throw new Error(`[apiEnv] ${key} must be set in production.`);
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`[apiEnv] ${key} is required.`);
}

function readNumberEnv(key: string, fallback: number, options?: { min?: number }): number {
  const raw = process.env[key]?.trim();
  const value = raw ? Number(raw) : fallback;

  if (!Number.isFinite(value)) {
    throw new Error(`[apiEnv] ${key} must be a finite number.`);
  }

  if (options?.min !== undefined && value < options.min) {
    throw new Error(`[apiEnv] ${key} must be at least ${options.min}.`);
  }

  return value;
}

export const apiEnv = {
  nodeEnv: NODE_ENV,
  isProduction: IS_PRODUCTION,
  databaseUrl: readStringEnv('DATABASE_URL', DEFAULT_DATABASE_URL, {
    requiredInProduction: true,
  }),
  port: readNumberEnv('PORT', DEFAULT_PORT, { min: 1 }),
  jwtSecret: readStringEnv('JWT_SECRET', DEFAULT_JWT_SECRET, {
    requiredInProduction: true,
  }),
  codeRequestCooldownSeconds: readNumberEnv(
    'CODE_REQUEST_COOLDOWN_SECONDS',
    DEFAULT_CODE_REQUEST_COOLDOWN_SECONDS,
    { min: 1 },
  ),
  codeRequestBackstopWindowSeconds: readNumberEnv(
    'CODE_REQUEST_BACKSTOP_WINDOW_SECONDS',
    DEFAULT_CODE_REQUEST_BACKSTOP_WINDOW_SECONDS,
    { min: 1 },
  ),
  codeRequestBackstopLimit: readNumberEnv(
    'CODE_REQUEST_BACKSTOP_LIMIT',
    DEFAULT_CODE_REQUEST_BACKSTOP_LIMIT,
    { min: 1 },
  ),
  authThrottleLimit: readNumberEnv('AUTH_THROTTLE_LIMIT', DEFAULT_AUTH_THROTTLE_LIMIT, {
    min: 1,
  }),
} as const;

export const apiEnvDefaults = {
  databaseUrl: DEFAULT_DATABASE_URL,
  port: DEFAULT_PORT,
  jwtSecret: DEFAULT_JWT_SECRET,
  codeRequestCooldownSeconds: DEFAULT_CODE_REQUEST_COOLDOWN_SECONDS,
  codeRequestBackstopWindowSeconds: DEFAULT_CODE_REQUEST_BACKSTOP_WINDOW_SECONDS,
  codeRequestBackstopLimit: DEFAULT_CODE_REQUEST_BACKSTOP_LIMIT,
  authThrottleLimit: DEFAULT_AUTH_THROTTLE_LIMIT,
} as const;
