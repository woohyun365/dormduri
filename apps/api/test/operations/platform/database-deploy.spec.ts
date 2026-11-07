import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '../..');
const dbRoot = join(repoRoot, 'infra/db');
const deployRoot = join(repoRoot, 'infra/deploy');

const requiredDbFiles = [
  'README.md',
  'bootstrap-roles.sh',
  'migrate-deploy.sh',
  'apply-role-grants.sh',
  'smoke-role-grants.sh',
];

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function readDbFile(relativePath: string): string {
  return readFileSync(join(dbRoot, relativePath), 'utf8');
}

function readDeployFile(relativePath: string): string {
  return readFileSync(join(deployRoot, relativePath), 'utf8');
}

function readJson(relativePath: string): { scripts?: Record<string, string> } {
  return JSON.parse(readRepoFile(relativePath)) as { scripts?: Record<string, string> };
}

describe('production database deploy boundary', () => {
  it('keeps DB deploy runbook and scripts under infra/db', () => {
    const missingFiles = requiredDbFiles.filter(
      (relativePath) => !existsSync(join(dbRoot, relativePath)),
    );

    expect(missingFiles).toEqual([]);

    for (const script of requiredDbFiles.filter((file) => file.endsWith('.sh'))) {
      expect(statSync(join(dbRoot, script)).mode & 0o111).not.toBe(0);
    }
  });

  it('runs production migration through MIGRATION_DATABASE_URL and Prisma migrate deploy', () => {
    const script = readDbFile('migrate-deploy.sh');

    expect(script).toContain('MIGRATION_DATABASE_URL');
    expect(script).toContain('NODE_ENV=production');
    expect(script).toContain('DIRECT_URL="$MIGRATION_DATABASE_URL"');
    expect(script).toContain('DATABASE_URL="$MIGRATION_DATABASE_URL"');
    expect(script).toContain('exec prisma migrate deploy --schema prisma/schema.prisma');
    expect(script).not.toContain('prisma db push');
    expect(script).not.toContain('migrate dev');
    expect(script).not.toContain('echo "$MIGRATION_DATABASE_URL"');
  });

  it('applies the grant table in one psql transaction with error-stop semantics', () => {
    const script = readDbFile('apply-role-grants.sh');

    expect(script).toContain('MIGRATION_DATABASE_URL');
    expect(script).toContain('psql "$MIGRATION_DATABASE_URL"');
    expect(script).toContain('-v ON_ERROR_STOP=1');
    expect(script).toContain('--single-transaction');
    expect(script).toContain('role-grant-matrix.csv');
    expect(script).toContain('column-classes.csv');
    expect(script).toContain('\\\\copy pg_temp.role_grant_matrix FROM');
    expect(script.indexOf('-f "$inputs_sql"')).toBeLessThan(script.indexOf('-f "$defaults_sql"'));
    expect(script.indexOf('-f "$defaults_sql"')).toBeLessThan(script.indexOf('-f "$apply_sql"'));
    expect(script).toContain('DB_GRANT_SCHEMA');
    expect(script).not.toContain('echo "$MIGRATION_DATABASE_URL"');
  });

  it('smokes every LOGIN user against the grant table read-only without destructive DDL or DML', () => {
    const script = readDbFile('smoke-role-grants.sh');

    expect(script).toContain('MIGRATION_DATABASE_URL');
    expect(script).toContain('DATABASE_URL');
    expect(script).toContain('RETENTION_WORKER_DATABASE_URL');
    expect(script).toContain('RETENTION_DISCLOSURE_DATABASE_URL');
    expect(script).toContain('role-grant-matrix.csv');
    expect(script).toContain('smoke-role-grants.sql');
    expect(script).toContain("-c 'SET default_transaction_read_only = on'");
    expect(script).toContain('check_login DATABASE_URL app_runtime User RetainedIdentity');
    expect(script).toContain("*'permission denied'*");
    expect(script).toContain('DB_EXPECTED_TABLE_OWNER');
    expect(script).not.toMatch(/\b(CREATE|DROP|ALTER|TRUNCATE)\b/);
    expect(script).not.toMatch(/\bDELETE\s+FROM\b/);
    expect(script).not.toMatch(/\bUPDATE\s+\w+\s+SET\b/);
    expect(script).not.toMatch(/\bINSERT\s+INTO\b/);
    expect(script).not.toContain('echo "$DATABASE_URL"');
  });

  it('exposes explicit package scripts for one-off DB deploy gates', () => {
    const rootPackage = readJson('package.json');
    const apiPackage = readJson('apps/api/package.json');

    expect(rootPackage.scripts).toMatchObject({
      'api:db:bootstrap-roles': 'pnpm --dir apps/api db:bootstrap-roles',
      'api:db:deploy:migrate': 'pnpm --dir apps/api db:deploy:migrate',
      'api:db:deploy:role-grants': 'pnpm --dir apps/api db:deploy:role-grants',
      'api:db:deploy:smoke': 'pnpm --dir apps/api db:deploy:smoke',
    });
    expect(apiPackage.scripts).toMatchObject({
      'db:bootstrap-roles': '../../infra/db/bootstrap-roles.sh',
      'db:deploy:migrate': '../../infra/db/migrate-deploy.sh',
      'db:deploy:role-grants': '../../infra/db/apply-role-grants.sh',
      'db:deploy:smoke': '../../infra/db/smoke-role-grants.sh',
    });
  });

  it('keeps migration and role grant execution outside API container startup', () => {
    const dockerfile = readDeployFile('api/Dockerfile');
    const entrypoint = readDeployFile('api/entrypoint.sh');
    const deployReadme = readDeployFile('README.md');
    const dbReadme = readDbFile('README.md');

    expect(dockerfile).not.toContain('prisma migrate deploy');
    expect(dockerfile).not.toContain('prisma db push');
    expect(entrypoint).not.toContain('migrate-deploy.sh');
    expect(entrypoint).not.toContain('apply-role-grants.sh');
    expect(entrypoint).not.toContain('smoke-role-grants.sh');
    expect(deployReadme).toContain('migration과 role grant: `infra/db/`');
    expect(dbReadme).toContain('# Database operator scripts');
    expect(dbReadme).toContain('pnpm api:db:deploy:migrate');
    expect(dbReadme).toContain('pnpm api:db:deploy:role-grants');
    expect(dbReadme).toContain('pnpm api:db:deploy:smoke');
    expect(dbReadme).toContain('prisma migrate deploy');
    expect(dbReadme).toContain('prisma db push');
  });

  it('keeps passwords out of every DB script and LOGIN user creation in the master bootstrap only', () => {
    const grantScript = readDbFile('apply-role-grants.sh');
    const bootstrapScript = readDbFile('bootstrap-roles.sh');
    const bootstrapSql = readRepoFile('packages/database/prisma/role-grants/bootstrap-roles.sql');
    const dbReadme = readDbFile('README.md');
    const policy = readRepoFile('docs/policies/production-runtime-safety.md');

    expect(grantScript).not.toMatch(/\bCREATE\s+USER\b/);
    expect(grantScript).not.toMatch(/\bCREATE\s+ROLE\b.*\bLOGIN\b/);
    expect(grantScript).not.toMatch(/\bALTER\s+ROLE\b.*\bPASSWORD\b/);
    expect(grantScript).not.toMatch(/\bGRANT\s+\w+\s+TO\s+\w+\b/);
    expect(bootstrapScript).toContain('BOOTSTRAP_DATABASE_URL');
    expect(bootstrapScript).not.toContain('echo "$BOOTSTRAP_DATABASE_URL"');
    expect(bootstrapScript).not.toMatch(/\bPASSWORD\b/);
    expect(bootstrapSql).not.toMatch(/\bPASSWORD\b/);
    expect(dbReadme).toContain('bootstrap은 비밀번호를 정하지 않는다');
    expect(dbReadme).toContain('`\\password`');
    expect(policy).toContain('schema/table privilege baseline 적용을 소유한다');
  });
});
