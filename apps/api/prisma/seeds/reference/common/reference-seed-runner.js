import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const LOCAL_DATABASE_URL =
  'postgresql://knu_dev:knu_dev_password@localhost:5432/knu_roommate?schema=public';
const REFERENCE_SEED_LOCK_KEY = 'knu_roommate:reference-seed:v1';

function resolveReferenceSeedDatabaseUrl() {
  const configuredUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DIRECT_URL or DATABASE_URL is required for production reference seeding.');
  }

  return LOCAL_DATABASE_URL;
}

export async function runReferenceSeed(seedName, seedReferenceData) {
  const client = new Client({
    connectionString: resolveReferenceSeedDatabaseUrl(),
    application_name: `knu-roommate-reference-seed:${seedName}`,
  });

  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [REFERENCE_SEED_LOCK_KEY]);
    const summary = await seedReferenceData(client);
    await client.query('COMMIT');
    console.info(`[reference-seed] ${seedName} completed`, summary);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
