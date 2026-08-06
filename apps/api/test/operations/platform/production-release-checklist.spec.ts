import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(process.cwd(), '../..');

const requiredFiles = [
  'infra/runbooks/production-release-checklist.md',
  'infra/runbooks/incident-rollback.md',
  'docs/development/future-production-deployment-inputs.md',
];

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function expectContainsAll(content: string, expectedValues: string[]): void {
  for (const expected of expectedValues) {
    expect(content, `missing ${expected}`).toContain(expected);
  }
}

describe('production release readiness boundary', () => {
  it('keeps the readiness, rollback decision, and future deployment input documents', () => {
    const missingFiles = requiredFiles.filter(
      (relativePath) => !existsSync(join(repoRoot, relativePath)),
    );

    expect(missingFiles).toEqual([]);
  });

  it('preserves runtime, database, security, and observability release gates', () => {
    const checklist = readRepoFile('infra/runbooks/production-release-checklist.md');

    expectContainsAll(checklist, [
      'Release commit SHA',
      'API image tag',
      'Deployment decision record',
      'config/secret',
      '.env.api.example',
      'EMAIL_PROVIDER=ses',
      'DKIM',
      '/health',
      '/health/live',
      '/health/ready',
      'Prisma migration deploy',
      'role grant',
      'SSL/TLS',
      'Backup and restore drill',
      'api-restore-drill-manual',
      'nginx public ingress',
      'Socket.IO/WebSocket',
      '/internal/metrics',
      'HTTP_CORS_ALLOWED_ORIGINS',
      'CHAT_REALTIME_ALLOWED_ORIGINS',
      'Prometheus target up',
      'Loki log readout',
      'Grafana dashboard readout',
      'GO',
      'NO-GO',
      'GO with follow-up',
    ]);

    expect(checklist).not.toContain('API Production Deploy');
  });

  it('keeps secret-free local validation commands without claiming a deploy command', () => {
    const checklist = readRepoFile('infra/runbooks/production-release-checklist.md');

    expectContainsAll(checklist, [
      'pnpm api:check',
      'pnpm api:build',
      'pnpm api:db:deploy:migrate',
      'pnpm api:db:deploy:role-grants',
      'pnpm api:db:deploy:smoke',
      'pnpm api:db:restore-drill:smoke',
      'infra/deploy/scripts/api-release-smoke.sh',
      'stress:docker:smoke',
      'restore_drill_evidence_id',
      'redaction_confirmed',
    ]);

    expect(checklist).not.toContain('postgresql://...@');
    expect(checklist).not.toContain('Bearer <token>');
  });

  it('keeps rollback provider-neutral and separates app recovery from DB restore escalation', () => {
    const rollback = readRepoFile('infra/runbooks/incident-rollback.md');

    expectContainsAll(rollback, [
      'Previous safe artifact',
      'api-release-smoke.sh',
      'DB restore escalation',
      'PITR',
      'Temporary restored DB',
      'pnpm api:db:restore-drill:smoke',
      '자동 down migration을 기본 경로로 사용하지 않는다',
      'prisma db push',
      'Prometheus target',
      'Loki logs',
      'Grafana dashboard',
    ]);

    expect(rollback).toContain('금지');
    expect(rollback).not.toContain('postgresql://...@');
  });

  it('defines container assets as local rehearsal and leaves target choices as future inputs', () => {
    const deployReadme = readRepoFile('infra/deploy/README.md');
    const futureInputs = readRepoFile('docs/development/future-production-deployment-inputs.md');
    const policy = readRepoFile('docs/policies/production-deployment-readiness.md');

    expectContainsAll(deployReadme, [
      'local container rehearsal',
      'non-root',
      'Container startup',
      'migration',
      'api-release-smoke.sh --dry-run',
      'stress:docker:smoke',
      'observability rehearsal',
      'future-production-deployment-inputs.md',
    ]);
    expectContainsAll(futureInputs, [
      'Runtime topology',
      'Account and network boundary',
      'Database change ownership',
      'Canonical HTTPS surface',
      'Release and rollback control',
    ]);
    expect(policy).toContain('future-production-deployment-inputs.md');

    expect(deployReadme).toContain('production hosting target');
    expect(policy).toContain('target-specific rehearsal');
  });
});
