const DEFAULT_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/knu_roommate?schema=public';
const DEFAULT_PORT = 4000;
const DEFAULT_JWT_SECRET = 'local-jwt-secret';
const DEFAULT_CODE_REQUEST_COOLDOWN_SECONDS = process.env.NODE_ENV === 'production' ? 30 : 5;
const DEFAULT_AUTH_THROTTLE_LIMIT = process.env.NODE_ENV === 'production' ? 60 : 300;

export const apiEnv = {
  databaseUrl: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  jwtSecret: process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET,
  codeRequestCooldownSeconds: Number(
    process.env.CODE_REQUEST_COOLDOWN_SECONDS ?? DEFAULT_CODE_REQUEST_COOLDOWN_SECONDS,
  ),
  authThrottleLimit: Number(process.env.AUTH_THROTTLE_LIMIT ?? DEFAULT_AUTH_THROTTLE_LIMIT),
} as const;

export const apiEnvDefaults = {
  databaseUrl: DEFAULT_DATABASE_URL,
  port: DEFAULT_PORT,
  jwtSecret: DEFAULT_JWT_SECRET,
  codeRequestCooldownSeconds: DEFAULT_CODE_REQUEST_COOLDOWN_SECONDS,
  authThrottleLimit: DEFAULT_AUTH_THROTTLE_LIMIT,
} as const;
