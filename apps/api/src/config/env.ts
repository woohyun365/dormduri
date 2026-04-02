const DEFAULT_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/knu_roommate?schema=public';
const DEFAULT_PORT = 4000;
const DEFAULT_JWT_SECRET = 'dev-jwt-secret';

export const apiEnv = {
  databaseUrl: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  jwtSecret: process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET,
} as const;

export const apiEnvDefaults = {
  databaseUrl: DEFAULT_DATABASE_URL,
  port: DEFAULT_PORT,
  jwtSecret: DEFAULT_JWT_SECRET,
} as const;
