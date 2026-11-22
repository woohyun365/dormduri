import {
  ADMIN_DATABASE_URL_ENV,
  adminDatabaseUrl,
  bootstrapIntegrationRoles,
} from '../support/integration-database.js';

/** Creates the cluster-wide roles once before workers start (workers never run it in parallel). */
export default async function setup(): Promise<void> {
  const url = adminDatabaseUrl();
  process.env[ADMIN_DATABASE_URL_ENV] = url;
  await bootstrapIntegrationRoles(url);
}
