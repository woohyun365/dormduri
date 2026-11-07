import {
  bootstrapIntegrationDatabaseRoles,
  INTEGRATION_ADMIN_DATABASE_URL_ENV,
  INTEGRATION_DATABASE_ROLE_MODE_ENV,
  parseIntegrationDatabaseRoleMode,
} from '../integration/_support/integration-db-roles.js';

const DEFAULT_DATABASE_URL =
  'postgresql://dormduri_dev:dormduri_dev_password@localhost:5432/dormduri?schema=public';

/**
 * Runs once in the Vitest main process before integration workers start. Workers
 * inherit the two env values below: the role mode and the admin URL that suites use
 * after they replace `DATABASE_URL` with a LOGIN user URL.
 */
export default async function setup(): Promise<void> {
  const mode = parseIntegrationDatabaseRoleMode(
    process.env[INTEGRATION_DATABASE_ROLE_MODE_ENV],
    'separated',
  );
  const adminDatabaseUrl =
    process.env[INTEGRATION_ADMIN_DATABASE_URL_ENV] ??
    process.env.DATABASE_URL ??
    DEFAULT_DATABASE_URL;

  process.env[INTEGRATION_DATABASE_ROLE_MODE_ENV] = mode;
  process.env[INTEGRATION_ADMIN_DATABASE_URL_ENV] = adminDatabaseUrl;

  if (mode === 'separated') {
    await bootstrapIntegrationDatabaseRoles(adminDatabaseUrl);
  }
}
