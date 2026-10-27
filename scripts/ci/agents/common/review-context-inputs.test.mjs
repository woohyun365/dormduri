import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { createPathTable, parsePathDomains } from '../../lifecycle/policy-first-check.mjs';

const MODULE = resolve(import.meta.dirname, '../../../agents/common/review-context-inputs.mjs');
// The module is new in this change, so each test asserts it exists before importing it.
async function load() {
  assert.ok(existsSync(MODULE), 'review-context-inputs module is missing');
  return import(pathToFileURL(MODULE).href);
}

const BINDING = 'docs/development/agent-workflows/domain/knu-binding.md';
const PACK_DIR = 'docs/development/agent-workflows/domain/swe-web';
const CRITERIA_DIR = 'docs/development/agent-workflows/review-criteria';
const INTENT = 'docs/product/intent.md';
const FE_DECISIONS = 'docs/architecture/decisions/fe.md';
const BE_DECISIONS = 'docs/architecture/decisions/be.md';
const PATH_DOMAINS = 'docs/policies/path-domains.json';
const SCREEN_MODEL = 'apps/web/src/screens/landing/model/view.ts';
const API_SEASON = 'apps/api/src/seasons/season.service.ts';
const DRAFT = '.artifacts/review/lifecycle.md';

function write(base, path, text) {
  mkdirSync(dirname(join(base, path)), { recursive: true });
  writeFileSync(join(base, path), text);
}
const criteria = (id) => `# ${id}\n\n### X1. item\n\n- 질문: q\n`;
// A repository in the real layout with an fe and a be pack layer. Only fe has a decision record; the binding
// document exists and must never become an input.
function fixture(t, { intent = false, decisions = [FE_DECISIONS], pathDomains = null } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'review-context-inputs-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  write(
    base,
    BINDING,
    [
      '# binding',
      '',
      '| 키 | 값 |',
      '| --- | --- |',
      '| `repo-structure.fe-screens` | `apps/web/src/screens/` |',
      '| `repo-structure.be-src` | `apps/api/src/**` |',
      '| `repo-structure.review-swe` | `apps/**`. 제외: `!**/*.md` |',
      '| `repo-structure.review-documents` | `**/*.md` |',
      '',
    ].join('\n'),
  );
  write(base, `${PACK_DIR}/README.md`, '# pack\n');
  const pack = (section, key) =>
    `## ${section}\n\n### binding 키\n\n- \`{{binding:repo-structure.${key}}}\`: 위치\n`;
  write(base, `${PACK_DIR}/fe.md`, `# fe\n\n${pack('component-architecture', 'fe-screens')}`);
  write(base, `${PACK_DIR}/be.md`, `# be\n\n${pack('service-layer', 'be-src')}`);
  write(base, `${CRITERIA_DIR}/README.md`, '# criteria\n');
  for (const id of ['swe', 'documents', 'web-fe-component-architecture', 'web-be-service-layer'])
    write(base, `${CRITERIA_DIR}/${id}.md`, criteria(id));
  for (const path of decisions) write(base, path, '# decisions\n');
  write(base, 'docs/architecture/decisions/README.md', '# Decision records\n');
  if (intent) write(base, INTENT, '# Intent\n');
  if (pathDomains !== null) {
    write(base, PATH_DOMAINS, `${JSON.stringify(pathDomains, null, 2)}\n`);
    for (const domain of new Set(pathDomains.entries.flatMap((entry) => entry.domains)))
      write(base, `docs/policies/${domain}.md`, `# ${domain}\n`);
  }
  return base;
}
const PATH_TABLE = {
  schema: 'lifecycle-path-domains/v1',
  confirmedBy: { status: 'draft', date: null, basis: null },
  productRoots: ['apps/**'],
  entries: [
    { globs: ['apps/api/src/seasons/**'], domains: ['season-lifecycle'] },
    { globs: ['apps/api/src/**'], except: ['apps/api/src/seasons/**'], domains: ['runtime'] },
  ],
  noDomain: [],
  irreversiblePaths: [],
};
const pathsOf = (record) => record.inputs.map((input) => input.path);

// RED 1: a layer the automatic selection picks contributes its decision record when the file exists; the binding
// document never does, and a layer without a record file contributes nothing.
test('a screen model path lists the fe decision record and never the binding document', async (t) => {
  const { reviewContextInputs } = await load();
  const root = fixture(t);
  const record = reviewContextInputs({ root, paths: [SCREEN_MODEL] });
  assert.equal(record.schema, 'review-context-inputs/v1');
  assert.deepEqual(record.paths, [SCREEN_MODEL]);
  assert.deepEqual(record.inputs, [
    {
      kind: 'decision',
      path: FE_DECISIONS,
      reason: {
        rule: 'layer',
        layer: 'fe',
        documents: ['web-fe-component-architecture'],
        paths: [SCREEN_MODEL],
      },
    },
  ]);
  for (const record_ of [record, reviewContextInputs({ root, paths: [SCREEN_MODEL, API_SEASON] })])
    assert.ok(!pathsOf(record_).includes(BINDING), 'the binding document is not an input');
  const api = reviewContextInputs({ root, paths: [API_SEASON] });
  assert.deepEqual(
    api.inputs.filter((input) => input.kind === 'decision'),
    [],
    'a layer without its record file has no decision input',
  );
  assert.deepEqual(api.absent, [{ kind: 'decision', path: BE_DECISIONS, layer: 'be' }]);
  // With the be record file present the same path takes it.
  write(root, BE_DECISIONS, '# be decisions\n');
  assert.deepEqual(pathsOf(reviewContextInputs({ root, paths: [API_SEASON] })), [BE_DECISIONS]);
});

// RED 2: the product intent record is an input only when the file exists.
test('the intent record is an input only in a root that has docs/product/intent.md', async (t) => {
  const { reviewContextInputs } = await load();
  const without = fixture(t);
  assert.ok(
    !pathsOf(reviewContextInputs({ root: without, paths: ['README.md'] })).includes(INTENT),
  );
  const root = fixture(t, { intent: true });
  const record = reviewContextInputs({ root, paths: ['README.md'] });
  assert.deepEqual(record.inputs, [{ kind: 'intent', path: INTENT, reason: { rule: 'intent' } }]);
  assert.deepEqual(pathsOf(reviewContextInputs({ root, paths: [SCREEN_MODEL] })), [
    INTENT,
    FE_DECISIONS,
  ]);
});

// RED 3: the policy domains are the Lifecycle gate's judgment of the product paths (P2a functions imported, not
// copied), and each judged domain's policy document is an input.
test('a path in a policy domain lists that policy document with the gate path table domains', async (t) => {
  const { reviewContextInputs } = await load();
  const root = fixture(t, { pathDomains: PATH_TABLE });
  const paths = [API_SEASON, 'apps/api/src/health/health.ts', 'docs/guide.md'];
  const record = reviewContextInputs({ root, paths });
  const table = createPathTable(parsePathDomains(readFileSync(join(root, PATH_DOMAINS), 'utf8')));
  const judged = [
    ...new Set(paths.filter(table.isProductPath).flatMap((path) => table.domainsOf(path))),
  ].sort();
  assert.deepEqual(judged, ['runtime', 'season-lifecycle']);
  const policies = record.inputs.filter((input) => input.kind === 'policy');
  assert.deepEqual(
    policies.map((input) => input.reason.domain),
    judged,
  );
  assert.deepEqual(policies, [
    {
      kind: 'policy',
      path: 'docs/policies/runtime.md',
      reason: {
        rule: 'policy-domain',
        domain: 'runtime',
        paths: ['apps/api/src/health/health.ts'],
      },
    },
    {
      kind: 'policy',
      path: 'docs/policies/season-lifecycle.md',
      reason: { rule: 'policy-domain', domain: 'season-lifecycle', paths: [API_SEASON] },
    },
  ]);
  // A path outside the product roots takes no domain, and a root without the path table judges none.
  assert.deepEqual(
    reviewContextInputs({ root, paths: ['docs/guide.md'] }).inputs.filter(
      (input) => input.kind === 'policy',
    ),
    [],
  );
  assert.deepEqual(
    reviewContextInputs({ root: fixture(t), paths: [API_SEASON] }).inputs.filter(
      (input) => input.kind === 'policy',
    ),
    [],
  );
  // A judged domain without its policy document is recorded as absent, not listed.
  rmSync(join(root, 'docs/policies/runtime.md'));
  const missing = reviewContextInputs({ root, paths });
  assert.ok(!pathsOf(missing).includes('docs/policies/runtime.md'));
  assert.ok(
    missing.absent.some(
      (entry) =>
        entry.kind === 'policy' &&
        entry.path === 'docs/policies/runtime.md' &&
        entry.domain === 'runtime',
    ),
  );
});

test('a malformed path table is refused instead of judging no domain', async (t) => {
  const { reviewContextInputs } = await load();
  const root = fixture(t, { pathDomains: PATH_TABLE });
  write(root, PATH_DOMAINS, '{"schema": "lifecycle-path-domains/v1"');
  assert.throws(() => reviewContextInputs({ root, paths: [API_SEASON] }), /path-domains\.json/u);
});

// The Parent's change-grade draft is the last input; it must be a readable file inside the root with a Lifecycle
// section.
test('a Parent change-grade draft is listed last and must be a Lifecycle draft inside the root', async (t) => {
  const { reviewContextInputs } = await load();
  const root = fixture(t, { intent: true });
  write(root, DRAFT, '# PR\n\n## Lifecycle\n\n- 변경 등급: bugfix\n');
  const record = reviewContextInputs({ root, paths: [SCREEN_MODEL], lifecycleDraft: DRAFT });
  assert.deepEqual(record.inputs.at(-1), {
    kind: 'lifecycle-draft',
    path: DRAFT,
    reason: { rule: 'lifecycle-draft' },
  });
  assert.deepEqual(pathsOf(record), [INTENT, FE_DECISIONS, DRAFT]);
  for (const draft of [
    '',
    '../outside.md',
    '/tmp/lifecycle.md',
    '.artifacts/review/none.md',
    'docs',
  ])
    assert.throws(
      () => reviewContextInputs({ root, paths: [SCREEN_MODEL], lifecycleDraft: draft }),
      /lifecycle-draft-invalid/u,
      JSON.stringify(draft),
    );
  write(root, '.artifacts/review/notes.md', '# notes\n\n- 변경 등급: bugfix\n');
  assert.throws(
    () =>
      reviewContextInputs({
        root,
        paths: [SCREEN_MODEL],
        lifecycleDraft: '.artifacts/review/notes.md',
      }),
    /lifecycle-draft-invalid: .*## Lifecycle/u,
  );
});

test('every input has a short label for reviewer input lines', async (t) => {
  const { contextInputLabel, reviewContextInputs } = await load();
  const root = fixture(t, { intent: true, pathDomains: PATH_TABLE });
  write(root, DRAFT, '## Lifecycle\n');
  const record = reviewContextInputs({
    root,
    paths: [SCREEN_MODEL, API_SEASON],
    lifecycleDraft: DRAFT,
  });
  assert.deepEqual(
    record.inputs.map((input) => `${input.path} (${contextInputLabel(input)})`),
    [
      `${INTENT} (product intent)`,
      `${FE_DECISIONS} (decision record, layer fe)`,
      'docs/policies/season-lifecycle.md (policy, domain season-lifecycle)',
      `${DRAFT} (Parent change-grade draft)`,
    ],
  );
});

test('the command line prints the record and refuses usage errors', async (t) => {
  await load();
  const root = fixture(t, { intent: true });
  write(root, DRAFT, '## Lifecycle\n');
  const run = (...args) => spawnSync(process.execPath, [MODULE, ...args], { encoding: 'utf8' });
  const ok = run('--root', root, '--lifecycle-draft', DRAFT, '--', SCREEN_MODEL);
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(pathsOf(JSON.parse(ok.stdout)), [INTENT, FE_DECISIONS, DRAFT]);
  assert.equal(run('--root', root).status, 2);
  const bad = run('--root', root, '--lifecycle-draft', 'missing.md', '--', SCREEN_MODEL);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /lifecycle-draft-invalid/u);
});
