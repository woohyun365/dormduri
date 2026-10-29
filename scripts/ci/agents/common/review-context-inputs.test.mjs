import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { createPathTable, parsePathDomains } from '../../lifecycle/policy-first-check.mjs';

const MODULE = resolve(import.meta.dirname, '../../../agents/common/review-context-inputs.mjs');
const REPO_ROOT = resolve(import.meta.dirname, '../../../..');
// The module is new in this change, so each test asserts it exists before importing it.
async function load() {
  assert.ok(existsSync(MODULE), 'review-context-inputs module is missing');
  return import(pathToFileURL(MODULE).href);
}
// The extract API (binding rows and the draft's Lifecycle section) is asserted the same way.
async function loadExtracts() {
  const module = await load();
  for (const name of ['collectReviewContext', 'placeReviewContext'])
    assert.equal(
      typeof module[name],
      'function',
      `review-context-inputs export ${name} is missing`,
    );
  return module;
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
const DRAFT_OUT = '.artifacts/review/out/lifecycle-section.md';
const BINDING_OUT = '.artifacts/review/out/binding.md';

function write(base, path, text) {
  mkdirSync(dirname(join(base, path)), { recursive: true });
  writeFileSync(join(base, path), text);
}
const criteria = (id) => `# ${id}\n\n### X1. item\n\n- 질문: q\n`;
const KEY_TABLE = [
  '# binding',
  '',
  '| 키 | 값 |',
  '| --- | --- |',
  '| `repo-structure.fe-screens` | `apps/web/src/screens/` |',
  '| `repo-structure.be-src` | `apps/api/src/**` |',
  '| `repo-structure.review-swe` | `apps/**`. 제외: `!**/*.md` |',
  '| `repo-structure.review-documents` | `**/*.md` |',
  '',
];
// The binding sections an extract reads (`## 고른 값`, `## 저장소 규약`) and two it never reads.
const VALUES_HEADER = '| 결정 | 상태 | 고른 값 |';
const FE_VALUE =
  '| `fe.comp.directory-unit` | known | 기능 단위. [근거](../../../../apps/web/README.md) |';
const BE_VALUE = '| `be.svc.layering/api` | known | service 계층 |';
const CONVENTIONS_HEADER = '| 사실 | 원본 | 관련 기준 항목 |';
const BE_CONVENTION =
  '| API 경로는 `api/<resource>` 접두다 | code: x | `web-be-service-layer.md X1` |';
const SWE_CONVENTION = '| 공통 envelope을 쓴다 | 규칙: y | `swe.md X1` |';
const VALUES_SECTION = [
  '## 고른 값',
  '',
  'Pack 결정에서 이 저장소가 고른 값입니다.',
  '',
  '- 결정: pack 결정 id입니다. 영역마다 값이 다르면 `<결정 id>/<영역 약칭>` 행으로 나눕니다.',
  '- 고른 값: 선택지 이름과 값 한 문장입니다.',
  '  둘째 줄도 같은 bullet입니다.',
  '',
  VALUES_HEADER,
  '| ---- | ---- | ------- |',
  FE_VALUE,
  BE_VALUE,
  '',
  '값이 바뀌면 그 행을 고칩니다.',
  '',
];
const CONVENTIONS_SECTION = [
  '## 저장소 규약',
  '',
  '기준 항목이 일반어로 가리키는 이 저장소의 규칙입니다.',
  '',
  '- 관련 기준 항목: 이 사실로 판정하는 기준 항목입니다.',
  '',
  CONVENTIONS_HEADER,
  '| ---- | ---- | -------------- |',
  BE_CONVENTION,
  SWE_CONVENTION,
  '',
];
const AREA_ROW =
  '| `fe.comp.directory-unit` 영역 검사 행 | `web-fe-component-architecture.md X1` |';
const SENSOR_ROW = '| `fe.comp.directory-unit` 센서 행 | `swe.md X1` |';
const OTHER_SECTIONS = [
  '## 영역 검사',
  '',
  '| 결정 | 관련 기준 항목 |',
  '| --- | --- |',
  AREA_ROW,
  '',
  '## 센서',
  '',
  '| 결정 | 관련 기준 항목 |',
  '| --- | --- |',
  SENSOR_ROW,
  '',
];
const BINDING_WITH_VALUES = [
  ...KEY_TABLE,
  ...VALUES_SECTION,
  ...CONVENTIONS_SECTION,
  ...OTHER_SECTIONS,
].join('\n');
// A pack layer file in the real form (README layer table, sublayer id line, decision list, risk line), so
// discovery-questions.mjs parses it.
const PACK_README = [
  '# pack',
  '',
  '| layer | 문서 | 하위 layer |',
  '| --- | --- | --- |',
  '| FE | [FE](./fe.md) | `component-architecture` |',
  '| BE | [BE](./be.md) | `service-layer` |',
  '',
].join('\n');
const packDecision = ([id, level]) =>
  [
    `#### ${id}`,
    '',
    `- 수준: \`${level}\``,
    '- 질문: q',
    '- 선택지:',
    '  - a: x',
    '- 먼저 정할 결정: 없음',
    '- 되돌림: `easy`',
    '- 기본값: d',
    '- 확인 단서: c',
    '- 기준 항목: i',
    '',
  ].join('\n');
const packLayer = (layer, section, key, decisions) =>
  [
    `# ${layer}`,
    '',
    `## ${section}`,
    '',
    `\`Domain/SWE/Web/${layer.toUpperCase()}/${section}\``,
    '',
    '### 결정 목록',
    '',
    ...decisions.map(packDecision),
    '### 위험',
    '',
    '- 비가역 선택: 없음',
    '',
    '### binding 키',
    '',
    `- \`{{binding:repo-structure.${key}}}\`: 위치`,
    '',
  ].join('\n');
// A repository in the real layout with an fe and a be pack layer. Only fe has a decision record; the binding
// document exists and must never become an input. With `values` the binding has its chosen value and
// convention sections and the pack its decisions.
function fixture(
  t,
  { intent = false, decisions = [FE_DECISIONS], pathDomains = null, values = false } = {},
) {
  const base = mkdtempSync(join(tmpdir(), 'review-context-inputs-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  write(base, BINDING, values ? BINDING_WITH_VALUES : KEY_TABLE.join('\n'));
  write(base, `${PACK_DIR}/README.md`, values ? PACK_README : '# pack\n');
  const pack = (section, key) =>
    `## ${section}\n\n### binding 키\n\n- \`{{binding:repo-structure.${key}}}\`: 위치\n`;
  write(
    base,
    `${PACK_DIR}/fe.md`,
    values
      ? packLayer('fe', 'component-architecture', 'fe-screens', [
          ['fe.comp.data-fetch', 'framework-pattern'],
          ['fe.comp.directory-unit', 'code-pattern'],
        ])
      : `# fe\n\n${pack('component-architecture', 'fe-screens')}`,
  );
  write(
    base,
    `${PACK_DIR}/be.md`,
    values
      ? packLayer('be', 'service-layer', 'be-src', [
          ['be.svc.runtime', 'framework-pattern'],
          ['be.svc.layering', 'code-pattern'],
        ])
      : `# be\n\n${pack('service-layer', 'be-src')}`,
  );
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

// The change-grade draft is the last input: its `## Lifecycle` section, cut from a readable file inside the root,
// at the output path given for it.
const DRAFT_TEXT = [
  '# PR',
  '',
  '## Summary',
  '',
  '- 요약 문장',
  '',
  '## Lifecycle',
  '',
  '- 변경 등급: bugfix',
  '',
  '### 인용 규칙',
  '',
  '- 없음',
  '',
  '## Changes',
  '',
  '- 변경 목록',
  '',
].join('\n');
const DRAFT_SECTION = [
  '## Lifecycle',
  '',
  '- 변경 등급: bugfix',
  '',
  '### 인용 규칙',
  '',
  '- 없음',
  '',
].join('\n');
test('a change-grade draft is listed last as its Lifecycle section and must be a Lifecycle draft inside the root', async (t) => {
  const { collectReviewContext, reviewContextInputs } = await loadExtracts();
  const root = fixture(t, { intent: true });
  write(root, DRAFT, DRAFT_TEXT);
  const outputs = { 'lifecycle-draft': DRAFT_OUT };
  const record = reviewContextInputs({
    root,
    paths: [SCREEN_MODEL],
    lifecycleDraft: DRAFT,
    outputs,
  });
  assert.deepEqual(record.inputs.at(-1), {
    kind: 'lifecycle-draft',
    path: DRAFT_OUT,
    reason: { rule: 'lifecycle-draft', draft: DRAFT },
  });
  assert.deepEqual(pathsOf(record), [INTENT, FE_DECISIONS, DRAFT_OUT]);
  // RED 10: only the Lifecycle section, byte for byte; Summary and Changes stay out.
  const context = collectReviewContext({ root, paths: [SCREEN_MODEL], lifecycleDraft: DRAFT });
  assert.equal(
    context.extracts['lifecycle-draft'],
    DRAFT_SECTION,
    'lifecycle extract is the section',
  );
  assert.equal(context.record.inputs.at(-1).path, null, 'an unplaced extract has no path yet');
  // A draft extract without its output path is refused, never read from the original file.
  assert.throws(
    () => reviewContextInputs({ root, paths: [SCREEN_MODEL], lifecycleDraft: DRAFT }),
    /context-output-missing: .*--lifecycle-out/u,
  );
  for (const draft of [
    '',
    '../outside.md',
    '/tmp/lifecycle.md',
    '.artifacts/review/none.md',
    'docs',
  ])
    assert.throws(
      () => reviewContextInputs({ root, paths: [SCREEN_MODEL], lifecycleDraft: draft, outputs }),
      /lifecycle-draft-invalid/u,
      JSON.stringify(draft),
    );
  write(root, '.artifacts/review/notes.md', '# notes\n\n- 변경 등급: bugfix\n');
  write(root, '.artifacts/review/twice.md', '## Lifecycle\n\n- a\n\n## Lifecycle\n\n- b\n');
  for (const [draft, reason] of [
    ['.artifacts/review/notes.md', /lifecycle-draft-invalid: .*## Lifecycle/u],
    ['.artifacts/review/twice.md', /lifecycle-draft-invalid: .*more than one "## Lifecycle"/u],
  ])
    assert.throws(
      () => reviewContextInputs({ root, paths: [SCREEN_MODEL], lifecycleDraft: draft, outputs }),
      reason,
      draft,
    );
});

test('every input has a short label for reviewer input lines', async (t) => {
  const { contextInputLabel, reviewContextInputs } = await loadExtracts();
  const root = fixture(t, { intent: true, pathDomains: PATH_TABLE, values: true });
  write(root, DRAFT, '## Lifecycle\n');
  const record = reviewContextInputs({
    root,
    paths: [SCREEN_MODEL, API_SEASON],
    lifecycleDraft: DRAFT,
    outputs: { 'binding-values': BINDING_OUT, 'lifecycle-draft': DRAFT_OUT },
  });
  assert.deepEqual(
    record.inputs.map((input) => `${input.path} (${contextInputLabel(input)})`),
    [
      `${INTENT} (product intent)`,
      `${FE_DECISIONS} (decision record, layer fe)`,
      'docs/policies/season-lifecycle.md (policy, domain season-lifecycle)',
      `${BINDING_OUT} (binding rows for the selected criteria: 2 chosen values, 2 repository conventions)`,
      `${DRAFT_OUT} (Lifecycle draft given for this review)`,
    ],
  );
  // RED 8: the draft label names no author.
  assert.doesNotMatch(contextInputLabel(record.inputs.at(-1)), /Parent/u);
});

test('the command line prints the record and refuses usage errors', async (t) => {
  await loadExtracts();
  const root = fixture(t, { intent: true });
  write(root, DRAFT, '## Lifecycle\n');
  const run = (...args) => spawnSync(process.execPath, [MODULE, ...args], { encoding: 'utf8' });
  const ok = run(
    '--root',
    root,
    '--lifecycle-draft',
    DRAFT,
    '--lifecycle-out',
    DRAFT_OUT,
    '--',
    SCREEN_MODEL,
  );
  assert.equal(ok.status, 0, ok.stderr);
  assert.deepEqual(pathsOf(JSON.parse(ok.stdout)), [INTENT, FE_DECISIONS, DRAFT_OUT]);
  assert.equal(readFileSync(join(root, DRAFT_OUT), 'utf8'), '## Lifecycle\n');
  assert.equal(run('--root', root).status, 2);
  // A misspelled or `=` form draft option and an option without its value never pass as review paths.
  for (const args of [
    ['--lifecycle_draft', DRAFT, '--', SCREEN_MODEL],
    [`--lifecycle-draft=${DRAFT}`, '--', SCREEN_MODEL],
    ['--lifecycle-draft', '--', SCREEN_MODEL],
    ['--lifecycle-draft', DRAFT, '--lifecycle-out', '--', SCREEN_MODEL],
    ['--binding-out', '--', SCREEN_MODEL],
    [`--binding-out=${BINDING_OUT}`, '--', SCREEN_MODEL],
  ])
    assert.equal(run('--root', root, ...args).status, 2, args.join(' '));
  const bad = run(
    '--root',
    root,
    '--lifecycle-draft',
    'missing.md',
    '--lifecycle-out',
    DRAFT_OUT,
    '--',
    SCREEN_MODEL,
  );
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /lifecycle-draft-invalid/u);
  // RED 10: a draft without --lifecycle-out is an input error.
  const unplaced = run('--root', root, '--lifecycle-draft', DRAFT, '--', SCREEN_MODEL);
  assert.equal(unplaced.status, 1, 'a draft without --lifecycle-out exits 1');
  assert.match(unplaced.stderr, /context-output-missing: .*--lifecycle-out/u);
});

// RED 1: a path in one pack sublayer takes the chosen value rows of that sublayer only; the binding document is
// still not an input.
test('a path in one pack sublayer takes the binding rows of that sublayer and never the binding document', async (t) => {
  const { collectReviewContext, reviewContextInputs } = await loadExtracts();
  const root = fixture(t, { values: true });
  const context = collectReviewContext({ root, paths: [SCREEN_MODEL] });
  const binding = context.record.inputs.filter((input) => input.kind === 'binding-values');
  assert.equal(binding.length, 1, 'one binding-values input');
  assert.deepEqual(binding[0].reason.decisions, [
    { row: 'fe.comp.directory-unit', document: 'web-fe-component-architecture' },
  ]);
  const text = context.extracts['binding-values'];
  assert.ok(text.includes(FE_VALUE), 'the fe sublayer row');
  assert.ok(!text.includes(BE_VALUE), 'no be sublayer row');
  const record = reviewContextInputs({
    root,
    paths: [SCREEN_MODEL],
    outputs: { 'binding-values': BINDING_OUT },
  });
  assert.deepEqual(pathsOf(record), [FE_DECISIONS, BINDING_OUT]);
  for (const paths of [[SCREEN_MODEL], [SCREEN_MODEL, API_SEASON]])
    assert.ok(
      !pathsOf(
        reviewContextInputs({ root, paths, outputs: { 'binding-values': BINDING_OUT } }),
      ).includes(BINDING),
      'the binding document is not an input',
    );
});

// RED 2: a convention row is in when its related criteria item names a selected document, swe included.
test('a convention row is in only when its related criteria item names a selected document', async (t) => {
  const { collectReviewContext } = await loadExtracts();
  const root = fixture(t, { values: true });
  const screen = collectReviewContext({ root, paths: [SCREEN_MODEL] });
  assert.ok(screen.extracts['binding-values'].includes(SWE_CONVENTION), 'swe.md convention row');
  assert.ok(!screen.extracts['binding-values'].includes(BE_CONVENTION), 'no be convention row');
  const api = collectReviewContext({ root, paths: [API_SEASON] });
  const [input] = api.record.inputs.filter((entry) => entry.kind === 'binding-values');
  assert.deepEqual(input.reason.conventions, [
    { fact: 'API 경로는 `api/<resource>` 접두다', documents: ['web-be-service-layer'] },
    { fact: '공통 envelope을 쓴다', documents: ['swe'] },
  ]);
});

// RED 3: only the two sections, each line exactly as in the binding and in its order, under a first line naming
// the binding path and its sha256.
test('the binding extract keeps two sections verbatim in binding order under the binding path and sha256', async (t) => {
  const { collectReviewContext } = await loadExtracts();
  const root = fixture(t, { values: true });
  const { extracts, record } = collectReviewContext({ root, paths: [SCREEN_MODEL, API_SEASON] });
  const digest = createHash('sha256')
    .update(readFileSync(join(root, BINDING)))
    .digest('hex');
  assert.equal(
    extracts['binding-values'],
    [
      `Copied from ${BINDING} sha256:${digest}. Relative links resolve from that file.`,
      '',
      ...VALUES_SECTION.slice(0, 1),
      '',
      ...VALUES_SECTION.slice(4, 7),
      '',
      VALUES_HEADER,
      VALUES_SECTION[9],
      FE_VALUE,
      BE_VALUE,
      '',
      ...CONVENTIONS_SECTION.slice(0, 1),
      '',
      CONVENTIONS_SECTION[4],
      '',
      CONVENTIONS_HEADER,
      CONVENTIONS_SECTION[7],
      BE_CONVENTION,
      SWE_CONVENTION,
      '',
    ].join('\n'),
  );
  for (const line of [...KEY_TABLE.slice(2, 8), AREA_ROW, SENSOR_ROW, '## 영역 검사', '## 센서'])
    assert.ok(!extracts['binding-values'].includes(line), `not in the extract: ${line}`);
  const [input] = record.inputs.filter((entry) => entry.kind === 'binding-values');
  assert.equal(input.reason.binding, BINDING);
  assert.equal(input.reason.sha256, `sha256:${digest}`);
});

// RED 4: paths no row is tied to (agent script, document, evidence copy) add neither the input nor an extract.
test('a path without binding rows adds no binding input and no extract', async (t) => {
  const { collectReviewContext, reviewContextInputs } = await loadExtracts();
  const root = fixture(t, { values: true });
  const run = (...args) => spawnSync(process.execPath, [MODULE, ...args], { encoding: 'utf8' });
  for (const path of [
    'scripts/agents/common/sample.mjs',
    'docs/guide.md',
    '.artifacts/heldout/r03/apps/web/src/screens/landing/model/view.ts',
  ]) {
    const context = collectReviewContext({ root, paths: [path] });
    assert.deepEqual(context.extracts, {}, path);
    assert.ok(!context.record.inputs.some((input) => input.kind === 'binding-values'), path);
    assert.deepEqual(
      reviewContextInputs({ root, paths: [path] }),
      reviewContextInputs({ root: fixture(t), paths: [path] }),
      `${path}: the record equals the record without binding sections`,
    );
    const out = run('--root', root, '--binding-out', BINDING_OUT, '--', path);
    assert.equal(out.status, 0, out.stderr);
    assert.ok(!existsSync(join(root, BINDING_OUT)), `${path}: no extract file`);
  }
});

// RED 5: --binding-out writes the extract at a repository-relative path and makes its parent directories; an
// absolute, outside, symlinked or missing output is refused.
test('the command line writes the binding extract and refuses a bad or missing output', async (t) => {
  await loadExtracts();
  const root = fixture(t, { values: true });
  const run = (...args) =>
    spawnSync(process.execPath, [MODULE, '--root', root, ...args], {
      encoding: 'utf8',
    });
  const ok = run('--binding-out', BINDING_OUT, '--', SCREEN_MODEL);
  assert.equal(ok.status, 0, ok.stderr);
  const record = JSON.parse(ok.stdout);
  assert.deepEqual(pathsOf(record), [FE_DECISIONS, BINDING_OUT]);
  const written = readFileSync(join(root, BINDING_OUT), 'utf8');
  assert.ok(written.includes(FE_VALUE), 'the extract file holds the row');
  // The same review again replaces the file.
  writeFileSync(join(root, BINDING_OUT), 'stale\n');
  assert.equal(run('--binding-out', BINDING_OUT, '--', SCREEN_MODEL).status, 0);
  assert.equal(readFileSync(join(root, BINDING_OUT), 'utf8'), written);
  assert.equal(run('--binding-out', '--', SCREEN_MODEL).status, 2, 'no value is a usage error');
  for (const [out, reason] of [
    ['/tmp/binding.md', /context-output-invalid/u],
    ['../binding.md', /context-output-invalid/u],
    [BINDING, /context-output-invalid/u],
  ]) {
    const refused = run('--binding-out', out, '--', SCREEN_MODEL);
    assert.equal(refused.status, 1, `${out} exits 1`);
    assert.match(refused.stderr, reason, out);
  }
  const missing = run('--', SCREEN_MODEL);
  assert.equal(missing.status, 1, 'rows without --binding-out exit 1');
  assert.match(missing.stderr, /context-output-missing: .*--binding-out/u);
  // u1: a symlinked output or a symlinked directory above it is never written through.
  const outside = mkdtempSync(join(tmpdir(), 'review-context-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  mkdirSync(join(root, '.artifacts/linked'), { recursive: true });
  symlinkSync(join(outside, 'target.md'), join(root, '.artifacts/linked/binding.md'));
  symlinkSync(outside, join(root, '.artifacts/outdir'));
  for (const out of ['.artifacts/linked/binding.md', '.artifacts/outdir/binding.md']) {
    const refused = run('--binding-out', out, '--', SCREEN_MODEL);
    assert.equal(refused.status, 1, `${out} exits 1`);
    assert.match(refused.stderr, /context-output-invalid: .*symlink/u, out);
  }
  assert.ok(!existsSync(join(outside, 'target.md')), 'nothing written through the link');
  assert.ok(!existsSync(join(outside, 'binding.md')), 'nothing written under the linked directory');
  assert.ok(lstatSync(join(root, '.artifacts/linked/binding.md')).isSymbolicLink());
});

// RED 11: the repository's own binding and pack give an API service path chosen value and convention rows
// under the binding's own table headers; a fixture whose header or related-criteria column is renamed stops.
test('the repository binding yields rows for an API service path and a renamed header stops the extract', async (t) => {
  const { collectReviewContext } = await loadExtracts();
  const { extracts } = collectReviewContext({ root: REPO_ROOT, paths: [API_SEASON] });
  const text = extracts['binding-values'] ?? '';
  const binding = readFileSync(join(REPO_ROOT, BINDING), 'utf8').split('\n');
  const headerOf = (heading) => {
    const start = binding.indexOf(heading);
    return binding.slice(start).find((line) => line.startsWith('|'));
  };
  const lines = text.split('\n');
  for (const heading of ['## 고른 값', '## 저장소 규약']) {
    const at = lines.indexOf(heading);
    assert.ok(at > 0, `${heading} section in the extract`);
    const header = lines.slice(at).find((line) => line.startsWith('|'));
    assert.equal(header, headerOf(heading), `${heading} header line equals the binding line`);
    const end = lines.findIndex((line, index) => index > at && /^## /u.test(line));
    const rows = lines
      .slice(at, end === -1 ? undefined : end)
      .filter((line) => line.startsWith('|'));
    assert.ok(rows.length >= 3, `${heading}: header, separator and at least one row`);
    for (const row of rows) assert.ok(binding.includes(row), `${heading}: ${row.slice(0, 40)}`);
  }
  const root = fixture(t, { values: true });
  for (const [from, to] of [
    [VALUES_HEADER, '| 결정 id | 상태 | 고른 값 |'],
    [CONVENTIONS_HEADER, '| 사실 | 원본 | 기준 항목 |'],
  ]) {
    write(root, BINDING, BINDING_WITH_VALUES.replace(from, to));
    assert.throws(
      () => collectReviewContext({ root, paths: [SCREEN_MODEL] }),
      /binding-values-invalid/u,
      to,
    );
  }
  // A pack the discovery parser refuses stops the extract instead of passing zero rows.
  write(root, BINDING, BINDING_WITH_VALUES);
  write(root, `${PACK_DIR}/README.md`, '# pack\n');
  assert.throws(
    () => collectReviewContext({ root, paths: [SCREEN_MODEL] }),
    /binding-values-invalid: .*README\.md/u,
  );
});
