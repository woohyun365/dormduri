import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  REVIEW_CRITERIA_SELECTION_SCHEMA,
  bindingPathGlobs,
  loadReviewCriteriaCatalog,
  matchPathGlob,
  matchReviewCriteriaPath,
  pathGlobSpecificity,
  selectReviewCriteria,
} from '../../../agents/common/review-criteria-selection.mjs';

const root = resolve(import.meta.dirname, '../../../..');
const cli = resolve(root, 'scripts/agents/common/review-criteria-selection.mjs');
const CRITERIA_DIR = 'docs/development/agent-workflows/review-criteria';
const PACK_DIR = 'docs/development/agent-workflows/domain/swe-web';
const BINDING = 'docs/development/agent-workflows/domain/knu-binding.md';

// Paths are untracked examples: selection matches names only and reads no product file.
// A small catalog in the repository's layout: one binding table, pack sublayer sections that name
// their path keys, and criteria documents whose header says what they select along.
const FIXTURE_BINDING = [
  ['repo-structure.fe-routes', '`apps/web/src/app/**`의 route·layout 파일'],
  ['repo-structure.fe-features', '`apps/web/src/<기능>/`(예: `main`, `auth`)'],
  ['repo-structure.bff-routes', '`apps/web/src/app/api/**`'],
  ['repo-structure.bff-helpers', '`apps/web/src/app/api/_bff/`'],
  [
    'repo-structure.server-session',
    '`apps/web/src/auth/server/`(session facade), `apps/web/src/example.ts`',
  ],
  ['repo-structure.be-src', '`apps/api/src/**`'],
  ['repo-structure.be-auth', '`apps/api/src/auth/**`'],
  ['repo-structure.review-swe', '`apps/**`, `packages/**`. 제외: `!**/*.md`'],
  ['repo-structure.review-documents', '`**/*.md`, `docs/**`'],
  ['tool.lint', 'ESLint `@repo/eslint-config/next`'],
];
const FIXTURE_PACKS = {
  'fe.md': {
    'rendering-boundary': ['fe-routes'],
    'state-data-cache': ['fe-features', 'bff-helpers'],
  },
  'bff.md': {
    'gateway-forwarding': ['bff-routes', 'bff-helpers'],
    'session-cookie-auth': ['server-session'],
  },
  'be.md': { 'authn-authz': ['be-src'] },
  'security-privacy.md': { 'trust-authz-model': ['be-auth', 'server-session'] },
};
const FIXTURE_CRITERIA = {
  swe: { letter: 'S', count: 3 },
  documents: { letter: 'D', count: 1 },
  'web-fe-rendering-boundary': { letter: 'F', count: 2, inherits: ['swe'] },
  'web-fe-state-data-cache': { letter: 'F', count: 1, inherits: ['swe'] },
  'web-bff-gateway-forwarding': { letter: 'B', count: 1, inherits: ['swe'] },
  'web-bff-session-cookie-auth': {
    letter: 'B',
    count: 1,
    inherits: ['swe', 'web-security-privacy-trust-authz-model'],
  },
  'web-be-authn-authz': { letter: 'A', count: 1, inherits: ['swe'] },
  'web-security-privacy-trust-authz-model': { letter: 'P', count: 1, inherits: ['swe'] },
};
function write(base, path, text) {
  mkdirSync(dirname(join(base, path)), { recursive: true });
  writeFileSync(join(base, path), text);
}
function criteriaText(id, { letter, count, inherits = [] }) {
  const header = inherits.length
    ? `이 문서를 고르면 ${inherits.map((x) => `[\`${x}\`](./${x}.md)`).join('와\n')}도 함께 고릅니다.\n`
    : '';
  const items = Array.from(
    { length: count },
    (_, i) => `### ${letter}${i + 1}. item ${i + 1}\n\n- 질문: q\n`,
  );
  return `# ${id}\n\n${header}\n${items.join('\n')}`;
}
function catalogFixture(t, { binding = FIXTURE_BINDING, packs = FIXTURE_PACKS } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'criteria-selection-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const rows = binding.map(([key, value]) => `| \`${key}\` | ${value} |`);
  write(base, BINDING, `# binding\n\n| 키 | 값 |\n| --- | --- |\n${rows.join('\n')}\n`);
  write(base, `${PACK_DIR}/README.md`, '# pack\n');
  for (const [file, sections] of Object.entries(packs))
    write(
      base,
      `${PACK_DIR}/${file}`,
      `# ${file}\n\n${Object.entries(sections)
        .map(
          ([name, keys]) =>
            `## ${name}\n\n### 상속\n\n- x\n\n### binding 키\n\n${keys
              .map((key) => `- \`{{binding:repo-structure.${key}}}\`: 위치`)
              .join('\n')}\n- \`{{binding:tool.lint}}\`: 도구\n`,
        )
        .join('\n')}`,
    );
  write(base, `${CRITERIA_DIR}/README.md`, '# criteria\n');
  for (const [id, spec] of Object.entries(FIXTURE_CRITERIA))
    write(base, `${CRITERIA_DIR}/${id}.md`, criteriaText(id, spec));
  return base;
}
const ids = (record) => record.documents.map((document) => document.id);
const areaIds = (record) => ids(record).filter((id) => id.startsWith('web-'));

test('a path selects the criteria documents whose binding path keys match it', (t) => {
  const catalog = loadReviewCriteriaCatalog(catalogFixture(t));
  const record = selectReviewCriteria({ paths: ['apps/web/src/app/example/page.tsx'], catalog });
  assert.equal(record.schema, REVIEW_CRITERIA_SELECTION_SCHEMA);
  assert.equal(record.override, false);
  assert.deepEqual(ids(record), ['swe', 'web-fe-rendering-boundary', 'web-fe-state-data-cache']);
  const rendering = record.documents.find(
    (document) => document.id === 'web-fe-rendering-boundary',
  );
  assert.equal(rendering.path, `${CRITERIA_DIR}/web-fe-rendering-boundary.md`);
  assert.equal(rendering.layer, 'fe');
  assert.deepEqual(rendering.items, [
    'web-fe-rendering-boundary.md F1',
    'web-fe-rendering-boundary.md F2',
  ]);
  assert.deepEqual(rendering.reasons, [
    {
      rule: 'path-key',
      path: 'apps/web/src/app/example/page.tsx',
      key: 'repo-structure.fe-routes',
      glob: 'apps/web/src/app/**',
      specificity: 4,
      layerSignal: 'present',
    },
  ]);
  // swe is matched by its own path key and selected along by each area document.
  const swe = record.documents.find((document) => document.id === 'swe');
  assert.deepEqual(
    swe.reasons.map((reason) => reason.rule),
    ['path-key', 'inherited', 'inherited'],
  );
  assert.equal(record.documentCount, 3);
  assert.equal(record.itemCount, 3 + 2 + 1);
  assert.deepEqual(record.unmatchedPaths, []);
});

test('between layers only the more specific path key selects; a layer keeps all, cross-cutting adds', (t) => {
  const catalog = loadReviewCriteriaCatalog(catalogFixture(t));
  // A BFF route is under the FE route and feature keys too; only the BFF document is chosen.
  const route = selectReviewCriteria({ paths: ['apps/web/src/app/api/chat/route.ts'], catalog });
  assert.deepEqual(areaIds(route), ['web-bff-gateway-forwarding']);
  assert.deepEqual(
    route.suppressed.map(({ id, by }) => [id, by]),
    [
      ['web-fe-rendering-boundary', 'web-bff-gateway-forwarding'],
      ['web-fe-state-data-cache', 'web-bff-gateway-forwarding'],
    ],
  );
  // A document that names the more specific key itself stays (a tie keeps both layers).
  const helper = selectReviewCriteria({
    paths: ['apps/web/src/app/api/_bff/example.ts'],
    catalog,
  });
  assert.deepEqual(areaIds(helper), ['web-bff-gateway-forwarding', 'web-fe-state-data-cache']);
  // A cross-cutting document neither suppresses nor is suppressed.
  const auth = selectReviewCriteria({ paths: ['apps/api/src/auth/login.ts'], catalog });
  assert.deepEqual(areaIds(auth), ['web-be-authn-authz', 'web-security-privacy-trust-authz-model']);
  assert.deepEqual(auth.suppressed, []);
  // The registry gives a server session path no bff signal: it is still chosen and the miss recorded.
  const session = selectReviewCriteria({ paths: ['apps/web/src/auth/server/read.ts'], catalog });
  assert.deepEqual(areaIds(session), [
    'web-bff-session-cookie-auth',
    'web-security-privacy-trust-authz-model',
  ]);
  const cookie = session.documents.find(
    (document) => document.id === 'web-bff-session-cookie-auth',
  );
  assert.equal(cookie.reasons[0].layerSignal, 'missing');
  assert.deepEqual(
    session.documents
      .find((document) => document.id === 'web-security-privacy-trust-authz-model')
      .reasons.map((reason) => reason.rule),
    ['path-key', 'inherited'],
  );
});

test('the area judgment of one path is exported for the area-criteria check', (t) => {
  const catalog = loadReviewCriteriaCatalog(catalogFixture(t));
  assert.deepEqual(matchReviewCriteriaPath('apps/web/src/app/api/chat/route.ts', catalog).areas, [
    'bff',
  ]);
  assert.deepEqual(matchReviewCriteriaPath('apps/api/src/auth/login.ts', catalog).areas, [
    'be',
    'security-privacy',
  ]);
  const none = matchReviewCriteriaPath('infra/deploy/api/Dockerfile', catalog);
  assert.deepEqual(none.areas, []);
  assert.deepEqual(none.documents, []);
});

test('binding values are read as path globs only inside backticks', () => {
  assert.deepEqual(bindingPathGlobs('`apps/web/src/<기능>/`(예: `main`, `auth`)'), {
    include: ['apps/web/src/*/**'],
    exclude: [],
  });
  assert.deepEqual(
    bindingPathGlobs('`apps/web/src/app/**`의 route 파일, `apps/web/src/example.ts`, `apps/api/*`'),
    { include: ['apps/web/src/app/**', 'apps/web/src/example.ts', 'apps/api/*'], exclude: [] },
  );
  assert.deepEqual(
    bindingPathGlobs('`apps/**`, `*`(root 파일). 제외: `!scripts/agents/**`, `!**/*.md`'),
    {
      include: ['apps/**', '*'],
      exclude: ['scripts/agents/**', '**/*.md'],
    },
  );
  assert.deepEqual(bindingPathGlobs('`renovate.json`, `.github/SECURITY.md`'), {
    include: ['renovate.json', '.github/SECURITY.md'],
    exclude: [],
  });
  for (const [path, glob, expected] of [
    ['apps/web/src/app/example/page.tsx', 'apps/web/src/app/**', true],
    ['apps/web/src/main/a/b.tsx', 'apps/web/src/*/**', true],
    ['apps/web/src/example.ts', 'apps/web/src/*/**', false],
    ['apps/web/src/example.ts', 'apps/web/src/example.ts', true],
    ['apps/api/example.json', 'apps/api/*', true],
    ['apps/api/src/example.ts', 'apps/api/*', false],
    ['README.md', '**/*.md', true],
    ['docs/a/b.md', '**/*.md', true],
    ['docs/a/b.mdx', '**/*.md', false],
    ['package.json', '*', true],
    ['.gitignore', '*', true],
    ['apps/x', '*', false],
    ['infra/image-inventory.json', 'infra/*.json', true],
  ])
    assert.equal(matchPathGlob(path, glob), expected, `${path} ~ ${glob}`);
  for (const [glob, expected] of [
    ['apps/web/src/*/**', 3],
    ['apps/web/src/app/**', 4],
    ['apps/web/src/app/api/_bff/**', 6],
    ['apps/web/src/example.ts', 4],
    ['**/*.md', 0],
    ['*', 0],
    ['infra/*.json', 1],
  ])
    assert.equal(pathGlobSpecificity(glob), expected, glob);
});

test('a path key exclusion removes its paths; documents only of Markdown select no swe', (t) => {
  const catalog = loadReviewCriteriaCatalog(catalogFixture(t));
  assert.deepEqual(ids(selectReviewCriteria({ paths: ['apps/api/example/README.md'], catalog })), [
    'documents',
  ]);
  const plain = selectReviewCriteria({ paths: ['docs/guide.md'], catalog });
  assert.deepEqual(ids(plain), ['documents']);
  const nothing = selectReviewCriteria({ paths: ['infra/main.tf'], catalog });
  assert.deepEqual(ids(nothing), []);
  assert.deepEqual(nothing.unmatchedPaths, ['infra/main.tf']);
});

test('given criteria override the automatic choice, which stays on record', (t) => {
  const catalog = loadReviewCriteriaCatalog(catalogFixture(t));
  const record = selectReviewCriteria({
    paths: ['apps/web/src/app/example/page.tsx'],
    catalog,
    criteria: ['documents'],
  });
  assert.equal(record.override, true);
  assert.deepEqual(record.requested, ['documents']);
  assert.deepEqual(ids(record), ['documents']);
  assert.deepEqual(record.documents[0].reasons, [{ rule: 'override' }]);
  assert.equal(record.itemCount, 1);
  assert.deepEqual(record.automatic.documents, [
    'swe',
    'web-fe-rendering-boundary',
    'web-fe-state-data-cache',
  ]);
  assert.throws(
    () => selectReviewCriteria({ paths: ['x'], catalog, criteria: ['missing'] }),
    /criteria-invalid: no .*missing\.md/u,
  );
});

test('a catalog whose sublayer has no path key, an unknown key or no document is refused', (t) => {
  const keyless = structuredClone(FIXTURE_PACKS);
  keyless['fe.md']['rendering-boundary'] = [];
  assert.throws(
    () => loadReviewCriteriaCatalog(catalogFixture(t, { packs: keyless })),
    /criteria-path-key-missing: .*fe\.md rendering-boundary/u,
  );
  const unknown = structuredClone(FIXTURE_PACKS);
  unknown['bff.md']['gateway-forwarding'] = ['nope'];
  assert.throws(
    () => loadReviewCriteriaCatalog(catalogFixture(t, { packs: unknown })),
    /binding-key-unresolved: repo-structure\.nope/u,
  );
  const orphan = structuredClone(FIXTURE_PACKS);
  orphan['bff.md']['missing-sublayer'] = ['bff-routes'];
  assert.throws(
    () => loadReviewCriteriaCatalog(catalogFixture(t, { packs: orphan })),
    /criteria-document-missing: .*web-bff-missing-sublayer\.md/u,
  );
  const globless = FIXTURE_BINDING.map(([key, value]) =>
    key === 'repo-structure.be-src' ? [key, 'API source'] : [key, value],
  );
  assert.throws(
    () => loadReviewCriteriaCatalog(catalogFixture(t, { binding: globless })),
    /binding-path-glob-missing: repo-structure\.be-src/u,
  );
  // Without a binding document there is nothing to select from, and nothing is refused.
  const bare = mkdtempSync(join(tmpdir(), 'criteria-selection-bare-'));
  t.after(() => rmSync(bare, { recursive: true, force: true }));
  const empty = selectReviewCriteria({
    paths: ['apps/web/src/app/example/page.tsx'],
    catalog: loadReviewCriteriaCatalog(bare),
  });
  assert.deepEqual(empty.documents, []);
  assert.deepEqual(empty.unmatchedPaths, ['apps/web/src/app/example/page.tsx']);
});

test('the repository catalog loads and picks documents by the Owner overlap rule', () => {
  const catalog = loadReviewCriteriaCatalog(root);
  const pick = (path) => ids(selectReviewCriteria({ paths: [path], catalog }));
  for (const key of ['review-swe', 'review-documents', 'review-agent-workflow-tooling'])
    assert.ok(catalog.keys[`repo-structure.${key}`], key);
  assert.deepEqual(pick('scripts/agents/claude/native-session.mjs'), ['agent-workflow-tooling']);
  assert.deepEqual(pick('scripts/ci/agents/common/review-criteria-selection.test.mjs'), [
    'agent-workflow-tooling',
  ]);
  assert.deepEqual(pick('docs/development/agent-workflows/qa.md'), ['documents']);
  assert.deepEqual(pick('.claude/skills/knu-review/SKILL.md'), [
    'agent-workflow-tooling',
    'documents',
  ]);
  // Repository scripts outside agent workflow take swe (an area key may add its own document).
  const lane = pick('scripts/ci/lanes/run-repo-policy.mjs');
  assert.ok(lane.includes('swe') && !lane.includes('agent-workflow-tooling'), lane.join());
  // #627 review F1: a BFF-only change no longer selects FE documents.
  const route = pick('apps/web/src/app/api/chat/route.ts');
  assert.ok(route.includes('web-bff-gateway-forwarding'), route.join());
  assert.ok(!route.some((id) => id.startsWith('web-fe-')), route.join());
  const session = pick('apps/web/src/auth/server/example.ts');
  assert.ok(session.includes('web-bff-session-cookie-auth'), session.join());
  assert.ok(session.includes('web-security-privacy-trust-authz-model'), session.join());
  assert.ok(!session.some((id) => id.startsWith('web-fe-')), session.join());
  const page = pick('apps/web/src/app/example/page.tsx');
  for (const id of [
    'swe',
    'web-fe-rendering-boundary',
    'web-fe-layout-responsive-device',
    'web-fe-accessibility',
  ])
    assert.ok(page.includes(id), `${id}: ${page.join()}`);
  assert.ok(!page.some((id) => id.startsWith('web-bff-')), page.join());
  assert.deepEqual(pick('apps/web/example/README.md'), ['documents']);
});

test('the CLI prints the selection record for paths and honours --criteria', (t) => {
  const base = catalogFixture(t);
  const run = (...args) =>
    spawnSync(process.execPath, [cli, '--root', base, ...args], { encoding: 'utf8' });
  const auto = run('--', 'apps/web/src/app/api/chat/route.ts', 'docs/guide.md');
  assert.equal(auto.status, 0, auto.stderr);
  const record = JSON.parse(auto.stdout);
  assert.deepEqual(ids(record), ['documents', 'swe', 'web-bff-gateway-forwarding']);
  const given = run('--criteria', 'documents', '--', 'apps/web/src/app/example/page.tsx');
  assert.equal(given.status, 0, given.stderr);
  assert.equal(JSON.parse(given.stdout).override, true);
  assert.equal(run().status, 2);
  assert.equal(run('--criteria', 'missing', '--', 'x').status, 1);
});
