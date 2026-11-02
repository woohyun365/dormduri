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

const stageRuleFiles = {
  readiness: releaseFiles.readiness,
  evidence: releaseFiles.evidence,
  targetReadiness: releaseFiles.targetReadiness,
  targetEvidence: releaseFiles.targetEvidence,
  sentryReadiness: 'infra/runbooks/release/components/web-sentry/readiness.md',
  policy: 'docs/policies/production-runtime-safety.md',
  environment: 'docs/deploy/production-environment.md',
} as const;

const recordLocationFiles = {
  sentryEvidence: 'infra/runbooks/release/components/web-sentry/evidence.md',
  collectorEvidence: releaseFiles.collectorEvidence,
  observabilityStack: 'infra/runbooks/operations/observability/production-stack.md',
  backofficeReadiness: releaseFiles.backofficeReadiness,
  runbooksIndex: 'infra/runbooks/README.md',
  collectorReadiness: releaseFiles.collectorReadiness,
  collectorIncident: releaseFiles.collectorTroubleshooting,
  releaseRollback: 'infra/runbooks/incidents/release-rollback.md',
  awsIndex: 'infra/aws/README.md',
  docsRunbooksIndex: 'docs/runbooks/README.md',
  webObservability: 'docs/architecture/frontend/web-observability.md',
} as const;

const stageRecordFields = [
  'stage',
  'release_id',
  'release_commit_sha',
  'images',
  'attestation',
  'components',
  'smoke',
  'rollback_check',
  'previous_safe',
  'aggregate_state',
  'final_decision',
  'operator',
  'collected_at',
  'risk_owner',
  'rollback_owner',
  'redaction_confirmed',
];

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

// Prose assertions compare sentences, so line wrapping and list indentation do not matter.
function prose(markdown: string): string {
  return markdown.replace(/\s+/g, ' ');
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

// GitHub heading anchor: lowercase, drop punctuation other than `-`·`_`, spaces become `-`.
function headingAnchors(content: string): Set<string> {
  const anchors = new Set<string>();
  for (const match of content.matchAll(/^#{1,6} (.+)$/gm)) {
    const heading = match[1];
    if (heading === undefined) {
      throw new Error('Markdown heading capture is missing.');
    }
    anchors.add(
      heading
        .toLowerCase()
        .replace(/[^\p{L}\p{N} _-]/gu, '')
        .replace(/ /g, '-'),
    );
  }
  return anchors;
}

function policyRule(policy: string, id: string): string {
  const start = policy.indexOf(`**${id}** `);
  if (start === -1) return '';
  const rest = policy.slice(start + id.length + 5);
  const next = rest.search(/\*\*PRS-R\d+\*\*|^## /m);
  return prose(next === -1 ? rest : rest.slice(0, next));
}

function markdownSection(content: string, heading: string): string {
  const start = content.indexOf(`\n${heading}\n`);
  expect(start, `missing section ${heading}`).toBeGreaterThanOrEqual(0);
  const rest = content.slice(start + heading.length + 2);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
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

  it('applies release rules to the components a stage deployment brings up', () => {
    const readiness = readRepoFile(stageRuleFiles.readiness);
    const evidence = readRepoFile(stageRuleFiles.evidence);
    const targetReadiness = readRepoFile(stageRuleFiles.targetReadiness);
    const policy = readRepoFile(stageRuleFiles.policy);
    const environment = readRepoFile(stageRuleFiles.environment);

    for (const [name, content] of Object.entries({
      readiness,
      targetReadiness,
      policy,
      environment,
    })) {
      expect(prose(content), `${name} must scope stage deployments`).toContain(
        '그 단계가 올리거나 바꾸는 구성요소',
      );
      expect(prose(content), `${name} must start DB items at the DB stage`).toContain(
        'DB를 들이는 단계',
      );
    }

    expectContainsAll(prose(markdownSection(readiness, '## 단계 배포')), [
      '최종 release에는 모든 항목을 적용한다',
      '`해당 없음(<이유>)`',
      '`ACCEPTED_RISK`로 적지 않는다',
      'aggregate state는 `COLLECTING`',
      'final decision은 `PENDING_TARGET`',
    ]);
    const stopConditions = prose(markdownSection(readiness, '## 중단 조건'));
    expectContainsAll(stopConditions, [
      '단계 배포에는 그 단계가 올리거나 바꾸는 구성요소에 위 중단 조건을 모두 적용한다',
      'DB backup/restore, migration, role grant는 DB를 들이는 단계부터 적용한다',
      'aggregate state를 `BLOCKED`로 바꾸지 않고',
      'final decision은 `PENDING_TARGET`로 둔다',
    ]);
    expect(prose(targetReadiness)).toContain(
      'DB가 아직 없는 단계 배포는 이 순서를 `해당 없음(DB 없음)`으로 기록한다',
    );
    expect(prose(readRepoFile(recordLocationFiles.releaseRollback))).toContain(
      '단계 배포는 그 단계가 올리거나 바꾸는 구성요소의 입력이 확정되면 그 단계 범위로 계획한다(`PRS-R48`)',
    );
    expect(markdownSection(targetReadiness, '## 중단 조건')).toContain('`해당 없음(DB 없음)`');

    const stageRules: Record<string, string[]> = {
      'PRS-R6': [
        '단계 배포에서 rollback은 그 단계가 올리거나 바꾸는 구성요소에 적용하고',
        'backup/restore drill은 DB를 들이는 단계부터 적용한다',
      ],
      'PRS-R31': ['단계 배포에는 DB를 들이는 단계부터 적용한다'],
      'PRS-R48': [
        '단계 배포의 CD는 그 단계가 올리거나 바꾸는 구성요소의 이 입력이 정해지면',
        'DB change ownership은 DB를 들이는 단계가 그 단계 CD 전에 정한다',
      ],
      'PRS-R51': [
        '최종 판정 입력이 아직 다 모이지 않았으면',
        '실패로 바꾸지 않고 `PENDING_TARGET`로 유지한다',
        '단계 배포는 최종 판정을 선언하지 않는다',
      ],
      'PRS-R54': [
        '다음 항목은 release blocker다. 단계 배포',
        '그 단계가 올리거나 바꾸는 구성요소의 항목을 적용하고',
        'DB를 들이는 단계부터 적용한다',
        '최종 release에는 모든 항목을 적용한다',
      ],
    };
    for (const [id, sentences] of Object.entries(stageRules)) {
      const rule = policyRule(policy, id);
      for (const sentence of sentences) {
        expect(rule, `${id} must keep: ${sentence}`).toContain(sentence);
      }
    }

    expect(evidence).toMatch(
      /\| `PENDING_TARGET` +\| 최종 판정 입력이 아직 다 모이지 않았다\(실제 target 입력이 없거나 단계 배포가 진행 중\)\. 실패로 집계하지 않는다\./,
    );
    expect(prose(evidence)).toContain(
      '`COLLECTING`은 단계 배포 기록이 하나 이상 있고 최종 판정 전인',
    );
  });

  it('records stage deployments in the release body and run summary with fixed fields', () => {
    const evidence = readRepoFile(stageRuleFiles.evidence);

    expect(prose(markdownSection(evidence, '## 실제 값의 기록 위치'))).toContain(
      'YAML·표는 template이며 실제 값을 채우지 않는다',
    );

    const stageRecord = markdownSection(evidence, '## 단계 배포 기록');
    expectContainsAll(prose(stageRecord), [
      '배포 tag에 붙은 GitHub Release 본문과 그 배포 workflow run의 요약',
      '배포 tag와 Release는 배포가 성공한 실행에만 만든다',
      '단계 기록으로 세지 않고 멈춘 조건과 되돌림 결과를 그 run 요약에 남긴다',
      '../../../docs/deploy/README.md#식별자-규칙',
      '최종 판정을 선언하지 않는다',
    ]);
    expect(prose(evidence)).toContain(
      '단계 배포 기록과 component evidence는 이 값을 선언하지 않는다',
    );
    const template = /```yaml\n([\s\S]*?)```/.exec(stageRecord)?.[1];
    expect(template, 'stage record template is missing').toBeDefined();
    expect(template?.match(/^[a-z_]+(?=:)/gm)).toEqual(stageRecordFields);
    expect(template).toContain('aggregate_state: COLLECTING');
    expect(template).toContain('final_decision: PENDING_TARGET');
    expect(template).toContain('redaction_confirmed: false');
  });

  it('keeps public-repository identifiers out of target evidence fields', () => {
    const targetEvidence = readRepoFile(stageRuleFiles.targetEvidence);
    const sentryReadiness = readRepoFile(stageRuleFiles.sentryReadiness);

    for (const field of [
      'User App instance',
      'BackOffice instance',
      'Private network / firewall',
      'Managed PostgreSQL 18 instance and private path',
    ]) {
      expect(targetEvidence, `${field} must not ask for an identifier value`).toContain(
        `| ${field}: Owner console 위치와 확인 여부(값 없음)`,
      );
    }
    expect(targetEvidence).not.toContain('provider / region / instance');
    expect(targetEvidence).not.toContain('Private network / firewall identifiers');
    expect(targetEvidence).toContain('../../../../../docs/deploy/README.md#식별자-규칙');
    expect(sentryReadiness).toContain('../../production-release-evidence.md#단계-배포-기록');
    expect(sentryReadiness).not.toContain('복사하거나 채운다');
  });

  it('sends actual values to the record location instead of tracked evidence documents', () => {
    const readiness = readRepoFile(stageRuleFiles.readiness);
    expect(readiness).not.toContain('release별 결과');

    for (const [name, path] of Object.entries(recordLocationFiles)) {
      const content = prose(readRepoFile(path));
      expect(content, `${name} must point at the record location`).toContain(
        'production-release-evidence.md#실제-값의-기록-위치',
      );
      for (const filling of [
        'release마다 채우는',
        '결과만 기록한다',
        'release evidence에서 채우며',
        'release 문서에 기록한다',
        'evidence.md)에만 기록한다',
        'evidence.md`에만 기록한다',
        'target release evidence에 기록한다',
        'component evidence로 남기고',
        'Result is linked from aggregate evidence',
      ]) {
        expect(content, `${name} must not fill values in place: ${filling}`).not.toContain(filling);
      }
    }
  });

  it('keeps local links and heading fragments in the stage rule documents resolvable', () => {
    const broken: string[] = [];

    for (const relativePath of [
      ...Object.values(stageRuleFiles),
      ...Object.values(recordLocationFiles),
    ]) {
      const sourcePath = join(repoRoot, relativePath);
      const content = readFileSync(sourcePath, 'utf8');
      for (const link of markdownLinks(content)) {
        if (link.startsWith('http')) continue;
        const fragmentIndex = link.indexOf('#');
        const target =
          fragmentIndex === 0 ? sourcePath : resolve(dirname(sourcePath), removeFragment(link));
        if (!existsSync(target)) {
          broken.push(`${relativePath} -> ${link}`);
          continue;
        }
        if (fragmentIndex === -1 || !target.endsWith('.md')) continue;
        const fragment = decodeURIComponent(link.slice(fragmentIndex + 1));
        if (!headingAnchors(readFileSync(target, 'utf8')).has(fragment)) {
          broken.push(`${relativePath} -> ${link}`);
        }
      }
    }

    expect(broken).toEqual([]);
  });
});
