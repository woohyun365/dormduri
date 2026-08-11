export function psqlDatabaseUrl(url) {
  const parsed = new URL(url);
  parsed.searchParams.delete('schema');
  return parsed.toString();
}

export function runDatabaseGates({
  databaseMode,
  urls,
  commandEnvironment,
  apiCompose,
  run,
  runOperatorScript,
  recordScenario,
}) {
  if (databaseMode === 'local') {
    apiCompose('up', '-d', '--wait', '--wait-timeout', '120', 'postgres');
    recordScenario('disposable-postgresql-18', 'pass', 'fresh local volume and PostgreSQL 18');
  }

  run('pnpm', ['api:db:deploy:migrate'], {
    env: { ...commandEnvironment, MIGRATION_DATABASE_URL: urls.host.migration },
    label: 'Prisma migrate deploy',
  });
  recordScenario('fresh-migration-deploy', 'pass', 'migration baseline applied');

  runOperatorScript('infra/db/apply-role-grants.sh', {
    MIGRATION_DATABASE_URL: psqlDatabaseUrl(urls.container.migration),
  });
  recordScenario('database-role-grants', 'pass', 'application role baseline applied');

  runOperatorScript('infra/db/smoke-role-grants.sh', {
    MIGRATION_DATABASE_URL: psqlDatabaseUrl(urls.container.migration),
    DATABASE_URL: psqlDatabaseUrl(urls.container.runtime),
    RETENTION_WORKER_DATABASE_URL: psqlDatabaseUrl(urls.container.retention),
    RETENTION_DISCLOSURE_DATABASE_URL: psqlDatabaseUrl(urls.container.disclosure),
  });
  recordScenario('database-credential-boundary', 'pass', 'runtime and retention grants verified');
}
