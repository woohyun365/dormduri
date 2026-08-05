import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '../..');
const runbooksRoot = join(repoRoot, 'infra/runbooks');

const requiredFiles = [
  'infra/runbooks/production-release-checklist.md',
  'infra/runbooks/incident-rollback.md',
];

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function readRunbook(fileName: string): string {
  return readFileSync(join(runbooksRoot, fileName), 'utf8');
}

function expectContainsAll(content: string, expectedValues: string[]): void {
  for (const expected of expectedValues) {
    expect(content, `missing ${expected}`).toContain(expected);
  }
}

describe('production release checklist closeout boundary', () => {
  it('keeps the final release checklist and incident rollback runbook in expected locations', () => {
    const missingFiles = requiredFiles.filter(
      (relativePath) => !existsSync(join(repoRoot, relativePath)),
    );

    expect(missingFiles).toEqual([]);
  });

  it('covers every production readiness gate needed for a BE API and managed PostgreSQL release decision', () => {
    const checklist = readRunbook('production-release-checklist.md');

    expectContainsAll(checklist, [
      'Release commit SHA',
      'API image tag',
      'config/secret',
      '.env.api.example',
      'Secrets Manager inventory dry-run',
      'placeholder/default secret',
      'EMAIL_PROVIDER=ses',
      'SES sender identity/domain',
      'DKIM',
      'sandbox production access',
      '/health',
      '/health/live',
      '/health/ready',
      'RDS endpoint',
      'Prisma migration deploy',
      'role grant',
      'SSL/TLS',
      'CloudWatch',
      'Backup and restore drill',
      'restore_drill_evidence_id',
      'api-restore-drill-manual',
      'nginx public ingress',
      'Socket.IO/WebSocket',
      '/internal/metrics',
      'HTTP_CORS_ALLOWED_ORIGINS',
      'CHAT_REALTIME_ALLOWED_ORIGINS',
      'GitHub workflow run id',
      'production environment approval',
      'OIDC',
      'Slack Alertmanager delivery smoke',
      'Prometheus target up',
      'Loki log readout',
      'Grafana dashboard readout',
      'GO',
      'NO-GO',
      'GO with follow-up',
    ]);
  });

  it('lists required commands and evidence ids without requiring secret values', () => {
    const checklist = readRunbook('production-release-checklist.md');

    expectContainsAll(checklist, [
      'pnpm check:api',
      'pnpm build:api',
      'pnpm api:db:deploy:migrate',
      'pnpm api:db:deploy:role-grants',
      'pnpm api:db:deploy:smoke',
      'pnpm api:db:restore-drill:smoke',
      'infra/deploy/scripts/api-release-smoke.sh',
      'stress:docker:smoke',
      'stress:docker:production-like',
      'stress:docker:237-ramp',
      'restore_drill_evidence_id',
      'restore_source_identifier',
      'restored_db_identifier',
      'redaction_confirmed',
    ]);

    expect(checklist).not.toContain('postgresql://...@');
    expect(checklist).not.toContain('Bearer <token>');
  });

  it('separates app rollback from DB restore escalation and forbids automatic down migration as the default path', () => {
    const rollback = readRunbook('incident-rollback.md');

    expectContainsAll(rollback, [
      'Previous safe image tag',
      'API_IMAGE_TAG',
      'api-production-rollout.sh',
      'api-release-smoke.sh',
      'DB restore escalation',
      'PITR',
      'temporary restored DB',
      'pnpm api:db:restore-drill:smoke',
      '자동 down migration을 기본 경로로 사용하지 않는다',
      'prisma db push',
      'Prometheus target',
      'Loki logs',
      'Grafana dashboard',
      'Slack alert',
      'RDS metrics',
    ]);

    expect(rollback).toContain('금지');
    expect(rollback).not.toContain('postgresql://...@');
  });

  it('connects release checklist and rollback runbook from deploy and official policy docs without plan-only wording', () => {
    const deployReadme = readRepoFile('infra/deploy/README.md');
    const deployRunbook = readRepoFile('infra/runbooks/api-production-deploy-runbook.md');
    const productionPolicy = readRepoFile('docs/policies/production-deployment-readiness.md');
    const observabilityPolicy = readRepoFile('docs/policies/runtime-observability-and-release.md');

    for (const doc of [deployReadme, deployRunbook, productionPolicy, observabilityPolicy]) {
      expect(doc).toContain('production-release-checklist.md');
      expect(doc).not.toMatch(/구현 예정|후속 Phase|이 plan|Phase 9에서/);
    }

    expect(deployReadme).toContain('incident-rollback.md');
    expect(deployRunbook).toContain('incident-rollback.md');
    expect(productionPolicy).toContain('incident-rollback.md');
    expect(observabilityPolicy).toContain('GO with follow-up');
  });
});
