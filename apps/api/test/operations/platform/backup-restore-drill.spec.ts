import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '../..');
const dbRoot = join(repoRoot, 'infra/db');
const awsRoot = join(repoRoot, 'infra/aws');
const runbooksRoot = join(repoRoot, 'infra/runbooks');
const workflowsRoot = join(repoRoot, '.github/workflows');

const requiredFiles = [
  'infra/aws/rds-setup-checklist.md',
  'infra/runbooks/backup-restore-drill.md',
  'infra/db/restore-drill-smoke.sh',
  '.github/workflows/api-restore-drill-manual.yml',
];

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function readDbFile(relativePath: string): string {
  return readFileSync(join(dbRoot, relativePath), 'utf8');
}

function readJson(relativePath: string): { scripts?: Record<string, string> } {
  return JSON.parse(readRepoFile(relativePath)) as { scripts?: Record<string, string> };
}

describe('backup and restore drill readiness boundary', () => {
  it('keeps RDS checklist, restore drill runbook, helper, and manual workflow in expected locations', () => {
    const missingFiles = requiredFiles.filter(
      (relativePath) => !existsSync(join(repoRoot, relativePath)),
    );

    expect(missingFiles).toEqual([]);
    expect(statSync(join(dbRoot, 'restore-drill-smoke.sh')).mode & 0o111).not.toBe(0);
  });

  it('documents RDS backup/PITR setup, private networking, SSL, monitoring, and RPO/RTO evidence', () => {
    const checklist = readFileSync(join(awsRoot, 'rds-setup-checklist.md'), 'utf8');

    expect(checklist).toContain('private subnet');
    expect(checklist).toContain('public access를 비활성화');
    expect(checklist).toContain('automated backup');
    expect(checklist).toContain('PITR');
    expect(checklist).toContain('Backup window');
    expect(checklist).toContain('Deletion protection');
    expect(checklist).toContain('Storage autoscaling');
    expect(checklist).toContain('SSL/TLS');
    expect(checklist).toContain('CloudWatch');
    expect(checklist).toContain('RPO');
    expect(checklist).toContain('RTO');
    expect(checklist).toContain('Multi-AZ');
    expect(checklist).toContain('Cross-region backup');
  });

  it('documents a non-destructive restore drill with migration, role grant, readiness, evidence, and cleanup gates', () => {
    const runbook = readFileSync(join(runbooksRoot, 'backup-restore-drill.md'), 'utf8');

    for (const expected of [
      'Release commit SHA',
      'Source DB identifier',
      'automated backup/PITR',
      'manual snapshot',
      'temporary restored DB',
      'public access',
      'security group',
      'migration baseline',
      'role grant',
      'pnpm api:db:restore-drill:smoke',
      '/health/ready',
      'api-release-smoke.sh',
      'cleanup',
      'secret 없는',
    ]) {
      expect(runbook).toContain(expected);
    }

    expect(runbook).toContain('Production source DB에서 fixture seed, reset');
    expect(runbook).not.toContain('postgresql://...@');
  });

  it('maps restore-drill credentials to the existing role-grant smoke without printing secret values', () => {
    const helper = readDbFile('restore-drill-smoke.sh');

    expect(helper).toContain('--dry-run');
    expect(helper).toContain('RESTORE_DRILL_MIGRATION_DATABASE_URL');
    expect(helper).toContain('RESTORE_DRILL_DATABASE_URL');
    expect(helper).toContain('RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL');
    expect(helper).toContain('RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL');
    expect(helper).toContain('MIGRATION_DATABASE_URL="$RESTORE_DRILL_MIGRATION_DATABASE_URL"');
    expect(helper).toContain('DATABASE_URL="$RESTORE_DRILL_DATABASE_URL"');
    expect(helper).toContain(
      'RETENTION_WORKER_DATABASE_URL="$RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL"',
    );
    expect(helper).toContain(
      'RETENTION_DISCLOSURE_DATABASE_URL="$RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL"',
    );
    expect(helper).toContain('smoke-role-grants.sh');
    expect(helper).not.toContain('echo "$RESTORE_DRILL_MIGRATION_DATABASE_URL"');
    expect(helper).not.toContain('echo "$RESTORE_DRILL_DATABASE_URL"');
    expect(helper).not.toContain('echo "$RESTORE_DRILL_RETENTION_WORKER_DATABASE_URL"');
    expect(helper).not.toContain('echo "$RESTORE_DRILL_RETENTION_DISCLOSURE_DATABASE_URL"');
  });

  it('exposes package scripts for the restore drill smoke helper', () => {
    const rootPackage = readJson('package.json');
    const apiPackage = readJson('apps/api/package.json');

    expect(rootPackage.scripts).toMatchObject({
      'api:db:restore-drill:smoke': 'pnpm --dir apps/api db:restore-drill:smoke',
    });
    expect(apiPackage.scripts).toMatchObject({
      'db:restore-drill:smoke': '../../infra/db/restore-drill-smoke.sh',
    });
  });

  it('keeps the manual restore drill workflow protected, manual, dry-run-first, and non-destructive', () => {
    const workflow = readFileSync(join(workflowsRoot, 'api-restore-drill-manual.yml'), 'utf8');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('dry_run:');
    expect(workflow).toContain('default: true');
    expect(workflow).toContain('environment: production');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).not.toContain('id-token: write');
    expect(workflow).not.toContain('AWS_ACCESS_KEY_ID');
    expect(workflow).not.toContain('AWS_SECRET_ACCESS_KEY');
    expect(workflow).not.toContain('restore-db-instance-to-point-in-time');
    expect(workflow).not.toContain('restore-db-instance-from-db-snapshot');
    expect(workflow).toContain('pnpm api:db:restore-drill:smoke -- --dry-run');
    expect(workflow).toContain('pnpm api:db:restore-drill:smoke');
    expect(workflow).toContain('infra/deploy/scripts/api-release-smoke.sh --dry-run');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('secret values are intentionally excluded');
  });

  it('connects restore drill evidence to DB, local rehearsal, and official readiness docs', () => {
    const dbReadme = readRepoFile('infra/db/README.md');
    const deployReadme = readRepoFile('infra/deploy/README.md');
    const policy = readRepoFile('docs/policies/production-deployment-readiness.md');
    const futureInputs = readRepoFile('docs/development/future-production-deployment-inputs.md');

    for (const doc of [dbReadme, deployReadme, policy]) {
      expect(doc).toMatch(/[Bb]ackup\/restore/);
      expect(doc).toContain('restore drill');
      expect(doc).not.toMatch(/구현 예정|후속 단계|이 plan|Phase \d+에서/);
    }

    expect(dbReadme).toContain('pnpm api:db:restore-drill:smoke');
    expect(deployReadme).toContain('.github/workflows/api-restore-drill-manual.yml');
    expect(futureInputs).toContain('backup/PITR 확인과 restore 승인 owner');
    expect(policy).toContain('api-restore-drill-manual.yml');
    expect(policy).toContain('backup restore 미검증');
  });
});
