import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '../..');
const dbRoot = join(repoRoot, 'infra/db');
const awsRoot = join(repoRoot, 'infra/aws');
const runbooksRoot = join(repoRoot, 'infra/runbooks/operations/database');
const workflowsRoot = join(repoRoot, '.github/workflows');

const requiredFiles = [
  'infra/aws/rds-setup-checklist.md',
  'infra/runbooks/operations/database/backup-restore.md',
  'infra/db/restore-drill-smoke.sh',
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
  it('keeps RDS checklist, restore drill runbook, and helper in expected locations', () => {
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
    const runbook = readFileSync(join(runbooksRoot, 'backup-restore.md'), 'utf8');

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

  // The RDS security group admits the user host only (D-AB5), so a GitHub-hosted runner cannot reach a restored DB.
  // The drill runs from the operator through the user host: SSM port forwarding for the DB smoke and a temporary API
  // container on the user host for readiness.
  it('runs the restore drill through the user host and keeps no GitHub-hosted restore drill workflow', () => {
    expect(existsSync(join(workflowsRoot, 'api-restore-drill-manual.yml'))).toBe(false);
    const workflowsWithDrill = readdirSync(workflowsRoot)
      .filter((name) => /\.ya?ml$/u.test(name))
      .filter((name) => {
        const workflow = readFileSync(join(workflowsRoot, name), 'utf8');
        return workflow.includes('restore-drill') || workflow.includes('RESTORE_DRILL_');
      });
    expect(workflowsWithDrill).toEqual([]);

    const runbook = readFileSync(join(runbooksRoot, 'backup-restore.md'), 'utf8');
    for (const expected of [
      'GitHub-hosted runner',
      'SSM 포트 포워딩',
      'user host',
      '임시 API container',
      'LIFECYCLE_SWEEP_ENABLED=false',
      'AUTH_MAIL_DISPATCHER_ENABLED=false',
      'CHAT_REALTIME_DISPATCHER_ENABLED=false',
      'http://127.0.0.1:',
    ]) {
      expect(runbook).toContain(expected);
    }
    expect(runbook).not.toContain('api-restore-drill.example.com');
  });

  it('connects restore drill evidence to its DB runbook and official readiness owner', () => {
    const dbReadme = readRepoFile('infra/db/README.md');
    const deployReadme = readRepoFile('infra/deploy/README.md');
    const policy = readRepoFile('docs/policies/production-runtime-safety.md');

    for (const doc of [dbReadme, policy]) {
      expect(doc).toMatch(/[Bb]ackup\/restore/);
      expect(doc).toContain('restore drill');
      expect(doc).not.toMatch(/구현 예정|후속 단계|이 plan|Phase \d+에서/);
    }

    expect(dbReadme).toContain('pnpm api:db:restore-drill:smoke');
    expect(dbReadme).toContain('infra/runbooks/operations/database/backup-restore.md');
    expect(deployReadme).toContain('infra/db/README.md');
    expect(deployReadme).not.toContain('.github/workflows/api-restore-drill-manual.yml');
    expect(policy).not.toContain('api-restore-drill-manual.yml');
    expect(policy).toMatch(/PRS-R32\*\*[^\n]*user host/u);
    expect(policy).toContain('backup restore 미검증');
  });
});
