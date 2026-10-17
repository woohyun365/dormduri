// In-memory repository for the lifecycle gate tests: a small path table, a tracking record, a policy README with rule id
// prefixes and policy documents. Revisions are named strings; a test overrides files per revision (null removes a file).

export const REVISIONS = { base: 'base-sha', mergeBase: 'merge-base-sha', head: 'head-sha' };
export const ISSUE = 634;

export const IRREVERSIBLE_POLICY = 'docs/policies/production-runtime-safety.md';

export function pathDomains({ confirmedBy, ...overrides } = {}) {
  return {
    schema: 'lifecycle-path-domains/v1',
    confirmedBy: confirmedBy ?? { status: 'owner-confirmed', date: '2026-10-01', basis: '#600' },
    productRoots: ['apps/**', 'infra/**'],
    entries: [
      {
        globs: ['apps/api/src/matches/**'],
        domains: ['matching-lifecycle', 'matching-algorithm'],
      },
      { globs: ['apps/api/src/chat/**'], domains: ['chat-lifecycle'] },
      {
        globs: ['apps/web/src/landing/**'],
        except: ['apps/web/src/landing/README.md'],
        domains: ['season-lifecycle'],
      },
      { globs: ['apps/api/prisma/**', 'infra/deploy/**'], domains: ['production-runtime-safety'] },
    ],
    noDomain: [
      { globs: ['apps/api/test/**', 'apps/*/README.md'], reason: '검증 코드와 안내 문서' },
    ],
    irreversiblePaths: [
      {
        glob: 'apps/api/prisma/migrations/**',
        policy: IRREVERSIBLE_POLICY,
        reason: 'down migration 없이 PITR로만 되돌린다',
      },
      { glob: 'infra/deploy/**', policy: IRREVERSIBLE_POLICY, reason: 'ingress·TLS·secret mount' },
    ],
    ...overrides,
  };
}

export const POLICY_NAMES = [
  'chat-lifecycle',
  'matching-algorithm',
  'matching-lifecycle',
  'production-runtime-safety',
  'season-lifecycle',
];

export function artifactMap({ confirmedBy, artifacts } = {}) {
  return {
    schema: 'lifecycle-artifact-map/v1',
    confirmedBy: confirmedBy ?? { status: 'owner-confirmed', date: '2026-10-01', basis: '#600' },
    artifacts: artifacts ?? [
      { artifact: 'prd-overview', mapping: 'legacy', sources: ['README.md'] },
      ...POLICY_NAMES.map((name) => ({
        artifact: `policy:${name}`,
        level: name === 'production-runtime-safety' ? 'cross-cutting-recommended' : 'domain',
        mapping: 'doc',
        sources: [`docs/policies/${name}.md`],
      })),
    ],
  };
}

export const POLICY_README = `# 공식 정책 세트

## 문서 구성

| 문서                                                           | 도메인          | 규칙 id 접두어 | 최종 소유 규칙 |
| -------------------------------------------------------------- | --------------- | -------------- | -------------- |
| [chat-lifecycle.md](./chat-lifecycle.md)                       | 채팅 상태       | CH             | thread         |
| [matching-algorithm.md](./matching-algorithm.md)               | 매칭 알고리즘   | MA             | 점수           |
| [matching-lifecycle.md](./matching-lifecycle.md)               | 매칭 상태       | ML             | 상태 전이      |
| [production-runtime-safety.md](./production-runtime-safety.md) | Production 안전 | PRS            | migration      |
| [season-lifecycle.md](./season-lifecycle.md)                   | 시즌 운영       | SL             | 시즌 기간      |
`;

export const POLICY_DOCUMENTS = {
  'chat-lifecycle': '# 채팅 상태\n\n- **CH-R1** 차단된 상대에게 쓰지 않는다.\n',
  'matching-algorithm': '# 매칭 알고리즘\n\n- **MA-R1** 점수는 0~100이다.\n',
  'matching-lifecycle': '# 매칭 상태\n\n- **ML-R1** 만료된 요청은 수락하지 않는다.\n',
  'production-runtime-safety': '# Production 안전\n\n- **PRS-R1** migration은 단일 owner다.\n',
  'season-lifecycle': '# 시즌 운영\n\n시즌 기간 규칙.\n',
};

export const PRODUCT_FILES = [
  'apps/api/src/matches/matches.service.ts',
  'apps/api/src/chat/chat.service.ts',
  'apps/web/src/landing/LandingPage.tsx',
  'apps/web/src/landing/README.md',
  'apps/api/test/matches.spec.ts',
  'apps/api/README.md',
  'apps/api/prisma/schema.prisma',
  'apps/api/prisma/migrations/20261001000000_init/migration.sql',
  'infra/deploy/api/Dockerfile',
];

export function defaultFiles() {
  return {
    'docs/policies/path-domains.json': `${JSON.stringify(pathDomains(), null, 2)}\n`,
    'docs/product/artifact-map.json': `${JSON.stringify(artifactMap(), null, 2)}\n`,
    'docs/policies/README.md': POLICY_README,
    ...Object.fromEntries(
      Object.entries(POLICY_DOCUMENTS).map(([name, text]) => [`docs/policies/${name}.md`, text]),
    ),
    ...Object.fromEntries(PRODUCT_FILES.map((path) => [path, `// ${path}\n`])),
  };
}

// head, mergeBase and base each override the default files; base defaults to mergeBase.
export function repository({ head = {}, mergeBase = {}, base } = {}) {
  const snapshot = (changes) => {
    const files = { ...defaultFiles(), ...changes };
    for (const [path, text] of Object.entries(files)) if (text === null) delete files[path];
    return files;
  };
  const files = {
    [REVISIONS.head]: snapshot(head),
    [REVISIONS.mergeBase]: snapshot(mergeBase),
    [REVISIONS.base]: snapshot(base ?? mergeBase),
  };
  const at = (revision) => {
    if (!files[revision]) throw new Error(`unknown fixture revision: ${revision}`);
    return files[revision];
  };
  return {
    readFile: (revision, path) => at(revision)[path] ?? null,
    listFiles: (revision) => Object.keys(at(revision)).sort(),
  };
}

export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

// A PR body in the template shape. fields: [name, value] pairs in order; omit `lifecycle` to leave the section out.
export function prBody({ lifecycle, issue = ISSUE } = {}) {
  const lines = [
    '## Summary',
    '',
    '- Outcome: 결과',
    '',
    '## Related',
    '',
    `- Development PR: Refs #${issue}`,
    '',
  ];
  if (lifecycle)
    lines.push('## Lifecycle', '', ...lifecycle.map(([name, value]) => `- ${name}: ${value}`), '');
  lines.push('## Changes', '', '변경 요약', '');
  return lines.join('\n');
}

export const cite = (name, id) => `[${name}.md ${id}](docs/policies/${name}.md)`;
