// In-memory repository for the area criteria check tests: the policy fixture's path table plus a small review criteria
// catalog. The FE and BFF pack sections overlap under `apps/web/src/app/api/`, the security-privacy section is
// cross-cutting, `repo-structure.mobile-app` has no pack section (an area without criteria) and `swe` is layerless. The
// binding document ends with the `영역 검사` exemption table; a test sets its rows per revision.

import { REVISIONS, repository } from '../policy-repo.mjs';

export { REVISIONS };

export const BINDING_FILE = 'docs/development/agent-workflows/domain/knu-binding.md';
const CRITERIA_DIR = 'docs/development/agent-workflows/review-criteria';
const PACK_DIR = 'docs/development/agent-workflows/domain/swe-web';

export const KEYS = {
  'repo-structure.fe-routes': '`apps/web/src/app/**`',
  'repo-structure.bff-routes': '`apps/web/src/app/api/**`',
  'repo-structure.secret-delivery': '`infra/deploy/**`',
  'repo-structure.mobile-app': '`apps/mobile/**`',
  'repo-structure.review-swe': '`apps/**`, `infra/**`, `*`(root 파일). 제외: `!**/*.md`',
};

// Rows of the `| 제외 경로 | 이유 |` table: [first cell, reason].
export const BASE_EXEMPTIONS = [['`apps/web/e2e/**`', '검증 코드. 현재 기준 없음']];

const PACKS = {
  fe: ['routing', 'repo-structure.fe-routes'],
  bff: ['routes', 'repo-structure.bff-routes'],
  'security-privacy': ['secrets', 'repo-structure.secret-delivery'],
};

// exemptions: rows, or null for a binding document without the `영역 검사` section.
export function bindingText({ exemptions = BASE_EXEMPTIONS } = {}) {
  const lines = [
    '# KNU domain binding',
    '',
    '| 키 | 값 |',
    '| --- | --- |',
    ...Object.entries(KEYS).map(([key, value]) => `| \`${key}\` | ${value} |`),
    '',
  ];
  if (exemptions !== null)
    lines.push(
      '## 영역 검사',
      '',
      '영역이 없는 제품 경로의 제외 표.',
      '',
      '| 제외 경로 | 이유 |',
      '| --- | --- |',
      ...exemptions.map(([globs, reason]) => `| ${globs} | ${reason} |`),
      '',
    );
  return lines.join('\n');
}

export const criteriaPath = (id) => `${CRITERIA_DIR}/${id}.md`;
export const packPath = (layer) => `${PACK_DIR}/${layer}.md`;

export function catalogFiles({ exemptions } = {}) {
  const files = { [BINDING_FILE]: bindingText({ exemptions }) };
  for (const [layer, [section, key]] of Object.entries(PACKS)) {
    files[packPath(layer)] =
      `# ${layer} pack\n\n## ${section}\n\n### binding 키\n\n- {{binding:${key}}}\n`;
    files[criteriaPath(`web-${layer}-${section}`)] = `# web-${layer}-${section}\n\n### A1. 항목\n`;
  }
  files[criteriaPath('swe')] = '# swe\n\n### S1. 항목\n';
  return files;
}

export const AREA_PRODUCT_FILES = [
  'apps/web/src/app/page.tsx',
  'apps/web/src/app/api/chat/route.ts',
  'apps/web/e2e/smoke.spec.ts',
  'apps/web/next.config.ts',
  'apps/web/vitest.config.ts',
  'apps/mobile/src/App.tsx',
];

const productFiles = () =>
  Object.fromEntries(AREA_PRODUCT_FILES.map((path) => [path, `// ${path}\n`]));

// headExemptions defaults to baseExemptions; head and base override files as in the policy fixture (null removes one).
export function areaRepository({ head = {}, base = {}, baseExemptions, headExemptions } = {}) {
  const snapshot = (exemptions, changes) => ({
    ...catalogFiles({ exemptions }),
    ...productFiles(),
    ...changes,
  });
  const baseFiles = snapshot(baseExemptions, base);
  return repository({
    head: snapshot(headExemptions === undefined ? baseExemptions : headExemptions, head),
    mergeBase: baseFiles,
    base: baseFiles,
  });
}
