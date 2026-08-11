import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(process.cwd(), '../..');

const releaseFiles = {
  readiness: 'infra/runbooks/release/production-release-readiness.md',
  evidence: 'infra/runbooks/release/production-release-evidence.md',
  targetReadiness: 'infra/runbooks/release/components/infrastructure-target/readiness.md',
  targetEvidence: 'infra/runbooks/release/components/infrastructure-target/evidence.md',
  collectorReadiness: 'infra/runbooks/release/components/observability-collector/readiness.md',
  collectorEvidence: 'infra/runbooks/release/components/observability-collector/evidence.md',
  collectorTroubleshooting: 'infra/runbooks/incidents/observability-collector.md',
  backofficeReadiness: 'infra/runbooks/release/components/backoffice/readiness.md',
} as const;

const componentOwners = [
  './components/infrastructure-target/readiness.md',
  './components/infrastructure-target/evidence.md',
  './components/observability-collector/readiness.md',
  './components/observability-collector/evidence.md',
  './components/web-sentry/readiness.md',
  './components/web-sentry/evidence.md',
  '../operations/database/backup-restore.md',
  '../operations/observability/production-stack.md',
  './components/auth/password-reset-evidence.md',
  './components/auth/registration-credential-evidence.md',
  '../incidents/release-rollback.md',
  '../../../docs/runbooks/observability/api-stress-release-runbook.md',
  '../operations/observability/slack-delivery.md',
  '../incidents/observability-alert-delivery.md',
  './components/backoffice/readiness.md',
];

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function expectContainsAll(content: string, expectedValues: string[]): void {
  for (const expected of expectedValues) {
    expect(content, `missing ${expected}`).toContain(expected);
  }
}

function markdownLinks(content: string): string[] {
  const links: string[] = [];

  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const link = match[1];
    if (link === undefined) {
      throw new Error('Markdown link target capture is missing.');
    }
    links.push(link);
  }

  return links;
}

function removeFragment(link: string): string {
  const fragmentIndex = link.indexOf('#');
  return fragmentIndex === -1 ? link : link.slice(0, fragmentIndex);
}

describe('production release evidence information architecture', () => {
  it('keeps one readiness entry and one aggregate decision owner', () => {
    expect(Object.values(releaseFiles).filter((path) => !existsSync(join(repoRoot, path)))).toEqual(
      [],
    );

    const readiness = readRepoFile(releaseFiles.readiness);
    const evidence = readRepoFile(releaseFiles.evidence);

    expectContainsAll(readiness, [
      '미래 배포 담당자와 Codex의 읽기 순서',
      '사용자에게 받아야 하는 입력',
      'Mandatory component owners',
      '중단 조건',
      'PENDING_TARGET',
    ]);
    for (const owner of componentOwners) {
      expect(readiness, `missing component owner ${owner}`).toContain(owner);
    }

    expectContainsAll(evidence, [
      'schema_version: 1',
      'aggregate_state: PENDING_TARGET',
      'final_decision: PENDING_TARGET',
      'operator:',
      'collected_at:',
      'risk_owner:',
      'rollback_owner:',
      'GO_WITH_FOLLOW_UP',
    ]);
    expect(readiness).toContain('최종 `GO` 판정을 소유하지 않는다');
    expect(evidence).toContain('최종 결정을 기록하는 유일한');
  });

  it('keeps readiness and actual evidence separate for target and collector decisions', () => {
    const targetReadiness = readRepoFile(releaseFiles.targetReadiness);
    const targetEvidence = readRepoFile(releaseFiles.targetEvidence);
    const collectorReadiness = readRepoFile(releaseFiles.collectorReadiness);
    const collectorEvidence = readRepoFile(releaseFiles.collectorEvidence);

    expectContainsAll(targetReadiness, [
      '사용자 준비물',
      'Registry와 artifact',
      'DNS, TLS, ingress',
      'Observability durability',
      '중단 조건',
      'BackOffice',
    ]);

    expectContainsAll(readRepoFile(releaseFiles.backofficeReadiness), [
      'FUTURE_COMPONENT',
      'User App 4GiB host + BackOffice 2GiB host',
      '목표 repository 구조',
      'Database와 migration 경계',
      'Observability 연결',
      '중단 조건',
    ]);
    expectContainsAll(targetEvidence, [
      'state: PENDING_TARGET',
      'release_commit_sha:',
      'operator:',
      'collected_at:',
      'risk_owner:',
      'rollback_owner:',
      'Registry, digest, and attestation',
      'HTTPS ingress and browser boundary',
      'Observability storage and recovery',
    ]);

    expectContainsAll(collectorReadiness, [
      '`/var/run/docker.sock:ro`',
      'authorization boundary가 아니다',
      'Socket 제거 trigger',
      'MIGRATE_HOST_TAIL',
      'MIGRATE_LOGGING_DRIVER',
      'MIGRATE_MANAGED',
    ]);
    expectContainsAll(collectorEvidence, [
      'state: PENDING_TARGET',
      'collector_mode: PENDING_TARGET',
      'collector_image_digest:',
      'operator:',
      'collected_at:',
      'risk_owner:',
      'rollback_owner:',
    ]);
  });

  it('keeps target absence as a non-failure state', () => {
    for (const path of Object.values(releaseFiles)) {
      const content = readRepoFile(path);
      if (content.includes('PENDING_TARGET')) {
        expect(content, `${path} must explain pending target semantics`).toMatch(
          /PENDING_TARGET.{0,100}(실패가 아니다|실패나 repository blocker가 아니다|FAIL이나 NO_GO가 아니다)/s,
        );
      }
    }
  });

  it('keeps collector failure isolation and migration choices executable', () => {
    const troubleshooting = readRepoFile(releaseFiles.collectorTroubleshooting);

    expectContainsAll(troubleshooting, [
      '증상별 첫 확인',
      '확인 명령',
      '즉시 격리',
      'Host Alloy + journald/file tail',
      'Docker logging driver',
      'Managed logging',
      'Rollback',
      'fail-open',
    ]);
  });

  it('keeps every local markdown link in the canonical readiness entry resolvable', () => {
    const readinessPath = join(repoRoot, releaseFiles.readiness);
    const readiness = readFileSync(readinessPath, 'utf8');
    const missingLinks = markdownLinks(readiness)
      .filter((link) => !link.startsWith('http') && !link.startsWith('#'))
      .map((link) => resolve(dirname(readinessPath), removeFragment(link)))
      .filter((path) => !existsSync(path));

    expect(missingLinks).toEqual([]);
  });

  it('keeps evidence templates free of credential-shaped examples', () => {
    const evidence = [
      readRepoFile(releaseFiles.evidence),
      readRepoFile(releaseFiles.targetEvidence),
      readRepoFile(releaseFiles.collectorEvidence),
    ].join('\n');

    expect(evidence).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(evidence).not.toMatch(/Bearer\s+[A-Za-z0-9._~-]{16,}/i);
    expect(evidence).not.toMatch(/(?:password|token|secret)\s*:\s*[^\s<][^\n]*/i);
    expect(evidence).not.toContain('Authorization:');
  });
});
