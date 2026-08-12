import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '../..');
const dbRoot = join(repoRoot, 'infra/db');
const deployRoot = join(repoRoot, 'infra/deploy');

const requiredDbFiles = [
  'README.md',
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

  it('applies role grant SQL artifacts with psql error-stop semantics', () => {
    const script = readDbFile('apply-role-grants.sh');

    expect(script).toContain('MIGRATION_DATABASE_URL');
    expect(script).toContain('psql "$MIGRATION_DATABASE_URL"');
    expect(script).toContain('-v ON_ERROR_STOP=1');
    expect(script).toContain('auth-role-grants.sql');
    expect(script).toContain('rrpd-role-grants.sql');
    expect(script.indexOf('-f "$rrpd_sql"')).toBeLessThan(script.indexOf('-f "$auth_sql"'));
    expect(script).toContain('knu_roommate.auth_schema');
    expect(script).toContain('knu_roommate.rrpd_schema');
    expect(script).toContain('DB_APP_RUNTIME_ROLE');
    expect(script).toContain('DB_RETENTION_WORKER_ROLE');
    expect(script).toContain('DB_RETENTION_DISCLOSURE_ROLE');
    expect(script).not.toContain('echo "$MIGRATION_DATABASE_URL"');
  });

  it('smokes runtime/retention/disclosure credentials without destructive DDL or DML', () => {
    const script = readDbFile('smoke-role-grants.sh');

    expect(script).toContain('MIGRATION_DATABASE_URL');
    expect(script).toContain('DATABASE_URL');
    expect(script).toContain('RETENTION_WORKER_DATABASE_URL');
    expect(script).toContain('RETENTION_DISCLOSURE_DATABASE_URL');
    expect(script).toContain('_prisma_migrations');
    expect(script).toContain('has_table_privilege');
    expect(script).toContain('RetainedIdentity');
    expect(script).toContain('RetentionAccessLog');
    expect(script).toContain('RetentionReviewJob');
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
      'api:db:deploy:migrate': 'pnpm --dir apps/api db:deploy:migrate',
      'api:db:deploy:role-grants': 'pnpm --dir apps/api db:deploy:role-grants',
      'api:db:deploy:smoke': 'pnpm --dir apps/api db:deploy:smoke',
    });
    expect(apiPackage.scripts).toMatchObject({
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

  it('documents that credential creation and role membership stay outside grant scripts', () => {
    const grantScript = readDbFile('apply-role-grants.sh');
    const dbReadme = readDbFile('README.md');
    const policy = readRepoFile('docs/policies/production-runtime-safety.md');

    expect(grantScript).not.toMatch(/\bCREATE\s+USER\b/);
    expect(grantScript).not.toMatch(/\bCREATE\s+ROLE\b.*\bLOGIN\b/);
    expect(grantScript).not.toMatch(/\bALTER\s+ROLE\b.*\bPASSWORD\b/);
    expect(grantScript).not.toMatch(/\bGRANT\s+\w+\s+TO\s+\w+\b/);
    expect(dbReadme).toContain('login role이 해당 application role의 member');
    expect(dbReadme).toContain(
      'password, LOGIN role 생성, role membership 부여를 자동 수행하지 않는다',
    );
    expect(policy).toContain('schema/table privilege baseline 적용을 소유한다');
  });
});
