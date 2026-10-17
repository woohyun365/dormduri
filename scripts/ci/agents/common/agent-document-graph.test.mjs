import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { anchors, links as markdownLinks, prose } from '../../../agents/common/markdown-links.mjs';
import { workflowGraph, validateWorkflowGraph } from '../../../agents/common/workflow-entry.mjs';
const root = resolve(import.meta.dirname, '../../../..');
const corpus = JSON.parse(
  readFileSync(
    resolve(root, 'scripts/ci/agents/common/fixtures/workflow-document-owners.json'),
    'utf8',
  ),
);
function markdownFiles(dir) {
  return readdirSync(resolve(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? markdownFiles(`${dir}/${entry.name}`)
      : entry.name.endsWith('.md')
        ? [`${dir}/${entry.name}`]
        : [],
  );
}
test('every current development Markdown owner is classified, with rationale rather than blanket rewrite', () => {
  const actual = markdownFiles('docs/development').sort();
  assert.deepEqual(corpus.documents.map((x) => x.path).sort(), actual);
  assert.equal(new Set(corpus.documents.map((x) => x.path)).size, actual.length);
  for (const row of corpus.documents) {
    assert.ok(row.owner && row.kind && row.rationale, row.path);
  }
});
test('actual document links/anchors resolve and every development owner is index-reachable', () => {
  const paths = corpus.documents.map((x) => x.path),
    edges = new Map();
  for (const path of paths) {
    const targets = markdownLinks(root, path);
    edges.set(
      path,
      targets.map((x) => x.path),
    );
    for (const target of targets) {
      assert.ok(existsSync(resolve(root, target.path)), `${path} -> ${target.path}`);
      if (target.fragment && target.path.endsWith('.md'))
        assert.ok(
          anchors(readFileSync(resolve(root, target.path), 'utf8')).has(target.fragment),
          `${path} -> ${target.path}#${target.fragment}`,
        );
    }
  }
  const reached = new Set();
  function visit(path) {
    if (reached.has(path)) return;
    reached.add(path);
    for (const next of edges.get(path) ?? []) visit(next);
  }
  visit('docs/development/README.md');
  assert.deepEqual(
    paths.filter((path) => !reached.has(path)),
    [],
  );
});
// Review criteria documents follow one item format under the common QA owner, and tracked criteria
// never cite ignored local evidence. There is no per-document item cap: items with different
// application conditions go to separate documents instead (the README keeps only that rule).
// An item holds the review view and the implementation view (지침·피함) in one block, in this order.
const CRITERIA_DIR = 'docs/development/agent-workflows/review-criteria';
// Common phrasings of a numeric item cap ("N개 이하", "최대 N"); the README keeps none of them.
const ITEM_CAP = /\d+\s*\**\s*개\s*\**\s*(?:이하|까지|를\s*넘지)|(?:최대|많아야)\s*\**\s*\d+/u;
// Web domain criteria documents (`web-<layer>-<sublayer>`) that the domain pack sublayers cite.
const WEB_CRITERIA = [
  'web-fe-rendering-boundary',
  'web-fe-state-data-cache',
  'web-fe-component-architecture',
  'web-fe-design-system',
  'web-fe-layout-responsive-device',
  'web-fe-accessibility',
  'web-bff-gateway-forwarding',
  'web-bff-session-cookie-auth',
  'web-bff-server-read-error-privacy-shaping',
  'web-security-privacy-trust-authz-model',
  'web-security-privacy-data-privacy-secret',
  'web-operations-release-release-gate',
  'web-operations-release-slo-signal',
].map((id) => `${CRITERIA_DIR}/${id}.md`);
const CRITERIA_FIELDS = [
  /^- 질문: \S/mu,
  /^- 기본 severity: `(?:critical|high|medium|low)`/mu,
  /^- 적용 조건: \S/mu,
  /^- 결함 패턴: \S/mu,
  /^- PASS 근거: \S/mu,
  /^- 지침: \S/mu,
  /^- 피함: \S/mu,
];
const CRITERIA_LABELS = CRITERIA_FIELDS.map((field) => field.source.match(/^\^- ([^:]+):/u)[1]);
const criteriaDocuments = () =>
  markdownFiles(CRITERIA_DIR)
    .filter((path) => path !== `${CRITERIA_DIR}/README.md`)
    .sort();
test('review criteria documents are registered owners with complete items and no item cap', () => {
  const readme = `${CRITERIA_DIR}/README.md`;
  // Every criteria document the helper can select is checked, not only the ones that exist today.
  const criteria = criteriaDocuments();
  for (const path of [
    `${CRITERIA_DIR}/agent-workflow-tooling.md`,
    `${CRITERIA_DIR}/documents.md`,
    `${CRITERIA_DIR}/swe.md`,
    ...WEB_CRITERIA,
  ])
    assert.ok(criteria.includes(path), path);
  const paths = corpus.documents.map((x) => x.path);
  for (const path of [readme, ...criteria]) {
    assert.ok(existsSync(resolve(root, path)), path);
    assert.ok(paths.includes(path), `${path} needs an owner row`);
  }
  const qa = readFileSync(resolve(root, 'docs/development/agent-workflows/qa.md'), 'utf8');
  assert.ok(
    markdownLinks(root, 'docs/development/agent-workflows/qa.md').some((x) => x.path === readme),
  );
  assert.match(qa, /^### Severity$/mu);
  const readmeText = readFileSync(resolve(root, readme), 'utf8');
  const format = readmeText
    .split(/^(?=## )/mu)
    .find((section) => section.startsWith('## 항목 형식'));
  assert.ok(format, `${readme}: 항목 형식 section`);
  assert.doesNotMatch(prose(readmeText), ITEM_CAP, `${readme} keeps a per-document item cap`);
  assert.match(format, /적용 조건이 다른 항목이 섞이면 문서를 나눕니다/u);
  assert.doesNotMatch(
    readmeText,
    /\.artifacts\/|\.plans\/|\.local-docs\//u,
    `${readme} cites ignored evidence`,
  );
  for (const path of criteria) {
    assert.ok(
      markdownLinks(root, readme).some((x) => x.path === path),
      `${readme} -> ${path}`,
    );
    const text = readFileSync(resolve(root, path), 'utf8');
    // A malformed item heading would otherwise merge into the previous item and skip every check.
    for (const heading of prose(text).match(/^#{3,} .*$/gmu) ?? [])
      assert.match(heading, /^### [A-Z]\d+\. \S/u, `${path}: malformed item heading ${heading}`);
    const items = prose(text)
      .split(/^(?=### [A-Z]\d+\. )/mu)
      .slice(1);
    assert.ok(items.length > 0, `${path}: no items`);
    const ids = items.map((item) => item.match(/^### ([A-Z]\d+)\. /u)[1]);
    assert.equal(new Set(ids).size, ids.length, `${path}: duplicate item id`);
    for (const item of items) {
      const at = CRITERIA_FIELDS.map((field) => item.search(field));
      for (const [i, field] of CRITERIA_FIELDS.entries()) {
        assert.ok(at[i] >= 0, `${path} ${item.split('\n')[0]}: missing ${field.source}`);
        assert.ok(
          i === 0 || at[i] > at[i - 1],
          `${path} ${item.split('\n')[0]}: ${field.source} out of order`,
        );
      }
      // Exactly the seven fields: no unknown or repeated field line. Indented lines continue a field.
      const fieldLines = item
        .split('\n')
        .slice(1)
        .filter((line) => line.trim() && !/^\s/u.test(line));
      assert.deepEqual(
        fieldLines.map((line) => line.match(/^- ([^:]+):/u)?.[1] ?? line),
        CRITERIA_LABELS,
        `${path} ${item.split('\n')[0]}: fields must be exactly the seven lines`,
      );
    }
    assert.doesNotMatch(
      text,
      /\.artifacts\/|\.plans\/|\.local-docs\//u,
      `${path} cites ignored evidence`,
    );
  }
});
// Plan-authoring guides cite criteria items by link and item anchor, so implementation and review
// read the same item. Every item must be cited by a guide, except in repository-only documents that
// no implementation guide owns. Domain pack documents cite items too; their citations must resolve,
// but they do not stand in for a guide citation.
const GUIDE_DIR = 'docs/development/agent-workflows/plan-authoring';
const PACK_DIR = 'docs/development/agent-workflows/domain/swe-web';
const UNCITED_CRITERIA = new Map([
  [
    `${CRITERIA_DIR}/agent-workflow-tooling.md`,
    'repository tooling criteria have no implementation guide',
  ],
  [`${CRITERIA_DIR}/documents.md`, 'repository document criteria have no implementation guide'],
]);
const criteriaItems = () =>
  new Map(
    criteriaDocuments().map((path) => [
      path,
      [
        ...prose(readFileSync(resolve(root, path), 'utf8')).matchAll(/^### ([A-Z]\d+)\. .*$/gmu),
      ].map((match) => ({ id: match[1], anchor: [...anchors(`${match[0]}\n`)][0] })),
    ]),
  );
test('plan-authoring guides cite criteria items that resolve, and every guided item is cited', () => {
  const criteria = criteriaDocuments();
  for (const path of UNCITED_CRITERIA.keys())
    assert.ok(criteria.includes(path), `stale uncited exemption ${path}`);
  const items = criteriaItems();
  const cited = new Set();
  assert.ok(existsSync(resolve(root, PACK_DIR)), `${PACK_DIR} is missing`);
  for (const source of [...markdownFiles(GUIDE_DIR), ...markdownFiles(PACK_DIR)])
    for (const target of markdownLinks(root, source).filter((x) => items.has(x.path))) {
      const item = items.get(target.path).find((x) => x.anchor === target.fragment);
      assert.ok(
        item,
        `${source} -> ${target.path}#${target.fragment ?? ''} is not a criteria item`,
      );
      if (source.startsWith(`${GUIDE_DIR}/`)) cited.add(`${target.path} ${item.id}`);
    }
  for (const [path, list] of items)
    if (!UNCITED_CRITERIA.has(path))
      for (const { id } of list)
        assert.ok(
          cited.has(`${path} ${id}`),
          `${path} ${id} is not cited by a plan-authoring guide`,
        );
});
// The domain pack lists every sublayer of a layer as one section with the same subsections. The
// guidance subsection links every item of that sublayer's criteria document, the criteria subsection
// lists the same item ids, and every decision a decision depends on is a decision of the pack.
const PACK_LAYERS = new Map([
  [
    'fe.md',
    {
      prefix: 'web-fe-',
      sublayers: [
        'rendering-boundary',
        'state-data-cache',
        'component-architecture',
        'design-system',
        'layout-responsive-device',
        'accessibility',
      ],
    },
  ],
  [
    'bff.md',
    {
      prefix: 'web-bff-',
      sublayers: ['gateway-forwarding', 'session-cookie-auth', 'server-read-error-privacy-shaping'],
    },
  ],
  [
    'security-privacy.md',
    {
      prefix: 'web-security-privacy-',
      sublayers: ['trust-authz-model', 'data-privacy-secret'],
    },
  ],
  [
    'operations-release.md',
    {
      prefix: 'web-operations-release-',
      sublayers: ['release-gate', 'slo-signal'],
    },
  ],
]);
const PACK_SECTIONS = ['상속', '결정 목록', '구현 지침', '검증 기준', '위험', 'binding 키'];
// Every decision block carries the README field lines in order; its depends-on value is `없음` or
// backticked decision ids, so a mistyped or missing dependency cannot pass unseen.
const DECISION_FIELDS = [
  '수준',
  '질문',
  '선택지',
  '먼저 정할 결정',
  '되돌림',
  '기본값',
  '확인 단서',
  '기준 항목',
];
const DECISION_LEVEL =
  /^- 수준: `(?:architecture-style|framework-pattern|code-pattern|policy|operational)`$/mu;
const DECISION_REVERSIBLE = /^- 되돌림: `(?:easy|costly|one-way)`\. \S/mu;
const DECISION_DEPENDS = /^- 먼저 정할 결정: (없음|`[a-z0-9.-]+`(?:, `[a-z0-9.-]+`)*)$/mu;
test('domain pack layer documents hold every sublayer with the required sections and its items', () => {
  for (const name of ['README.md', ...PACK_LAYERS.keys()])
    assert.ok(existsSync(resolve(root, `${PACK_DIR}/${name}`)), `${PACK_DIR}/${name}`);
  const items = criteriaItems();
  const decisions = new Set(),
    dependsOn = [];
  for (const [name, layer] of PACK_LAYERS) {
    const path = `${PACK_DIR}/${name}`;
    const text = prose(readFileSync(resolve(root, path), 'utf8'));
    for (const block of text.split(/^(?=#### )/mu).slice(1)) {
      const id = block.match(/^#### (\S+)$/mu)[1];
      const body = block.split(/^(?=#{2,3} )/mu)[0];
      decisions.add(id);
      assert.deepEqual(
        [...body.matchAll(/^- ([^:\n]+):/gmu)].map((match) => match[1]),
        DECISION_FIELDS,
        `${path} ${id}: decision fields`,
      );
      assert.match(body, DECISION_LEVEL, `${path} ${id}: 수준 must be one of the five levels`);
      assert.match(
        body,
        DECISION_REVERSIBLE,
        `${path} ${id}: 되돌림 must be easy, costly or one-way`,
      );
      const depends = body.match(DECISION_DEPENDS);
      assert.ok(depends, `${path} ${id}: 먼저 정할 결정 must be 없음 or backticked decision ids`);
      dependsOn.push(...[...depends[1].matchAll(/`([^`]+)`/gu)].map((ref) => `${path} ${ref[1]}`));
    }
    const sections = text.split(/^(?=## )/mu).slice(1);
    const names = sections.map((section) => section.match(/^## (.+)$/mu)[1].trim());
    assert.deepEqual(names, layer.sublayers, `${path}: sublayer sections`);
    for (const [i, section] of sections.entries()) {
      assert.deepEqual(
        (section.match(/^### .+$/gmu) ?? []).map((heading) => heading.slice(4).trim()),
        PACK_SECTIONS,
        `${path} ${names[i]}: subsections`,
      );
      const doc = `${CRITERIA_DIR}/${layer.prefix}${names[i]}.md`;
      assert.ok(items.has(doc), `${path} ${names[i]}: ${doc} is not a criteria document`);
      const part = (title) =>
        section.split(/^(?=### )/mu).find((block) => block.startsWith(`### ${title}\n`));
      const linked = new Set(
        markdownLinks(root, path, part('구현 지침'))
          .filter((x) => x.path === doc)
          .map((x) => x.fragment),
      );
      const file = doc.split('/').at(-1);
      assert.deepEqual(
        items
          .get(doc)
          .filter((item) => !linked.has(item.anchor))
          .map((item) => item.id),
        [],
        `${path} ${names[i]}: 구현 지침 must link every item of ${doc}`,
      );
      assert.deepEqual(
        [...part('검증 기준').matchAll(/`([a-z0-9-]+\.md [A-Z]\d+)`/gu)].map((x) => x[1]).sort(),
        items
          .get(doc)
          .map((item) => `${file} ${item.id}`)
          .sort(),
        `${path} ${names[i]}: 검증 기준 must list the item ids of ${doc}`,
      );
    }
  }
  for (const reference of dependsOn)
    assert.ok(decisions.has(reference.split(' ')[1]), `${reference} is not a decision of the pack`);
});
// Pack and criteria documents name repository values only through binding keys that the repository
// binding document resolves. The name list catches common leaks only; other values are a review item.
const BINDING_DOC = 'docs/development/agent-workflows/domain/knu-binding.md';
const BINDING_KINDS = new Set([
  'scope',
  'stack',
  'tool',
  'repo-structure',
  'product',
  'command',
  'policy',
]);
const REPOSITORY_VALUE =
  /apps\/|packages\/|\bpnpm\b|Next\.js|\bReact\b|NestJS|Prisma|Tailwind|Storybook|Vitest|Playwright|Sentry|\bKNU\b|PostgreSQL|Postgres|Docker|\bnginx\b|Lightsail|GitHub Actions|Grafana|Prometheus|\bLoki\b|\bAlloy\b|Alertmanager|\bk6\b|\bZod\b|TypedSQL|Dependabot|Renovate/u;
test('pack and criteria documents reference repository values only through resolvable binding keys', () => {
  assert.ok(existsSync(resolve(root, BINDING_DOC)), `${BINDING_DOC} is missing`);
  const keys = new Set(
    [...readFileSync(resolve(root, BINDING_DOC), 'utf8').matchAll(/^\| `([^`]+)` +\|/gmu)].map(
      (match) => match[1],
    ),
  );
  const documents = [
    `${CRITERIA_DIR}/swe.md`,
    ...criteriaDocuments().filter((path) => path.startsWith(`${CRITERIA_DIR}/web-`)),
    ...markdownFiles(PACK_DIR),
  ];
  for (const path of documents) {
    const text = prose(readFileSync(resolve(root, path), 'utf8'));
    assert.doesNotMatch(
      text.replace(/\{\{binding:[a-z-]+\.[a-z0-9-]+\}\}/gu, ''),
      /\{\{|\}\}|\bbindings?\s*:/u,
      `${path}: malformed binding reference`,
    );
    for (const [reference, key] of text.matchAll(/\{\{binding:([^}]*)\}\}/gu)) {
      const kind = key.match(/^([a-z-]+)\.[a-z0-9-]+$/u)?.[1];
      assert.ok(kind && BINDING_KINDS.has(kind), `${path}: malformed binding ${reference}`);
      assert.ok(keys.has(key), `${path}: ${reference} is not in ${BINDING_DOC}`);
    }
    assert.doesNotMatch(text, REPOSITORY_VALUE, `${path} names a repository value`);
  }
});
test('production workflow graph has real discoverable owners and required DAG without banning backlinks', () => {
  assert.deepEqual(validateWorkflowGraph(workflowGraph), []);
  for (const node of workflowGraph.nodes)
    assert.ok(existsSync(resolve(root, node.path)), node.path);
  for (const edge of workflowGraph.edges.filter((e) => e.kind === 'requires')) {
    const from = workflowGraph.nodes.find((n) => n.id === edge.from),
      to = workflowGraph.nodes.find((n) => n.id === edge.to);
    assert.match(
      readFileSync(resolve(root, from.path), 'utf8'),
      new RegExp(to.path.split('/').at(-1).replaceAll('.', '\\.')),
    );
  }
});
test('host mechanics remain scoped and no unrelated host is mandatory in shared entry', () => {
  for (const [path, pattern] of [
    [
      'agent-execution-contract.md',
      /adapters\/codex-native-registry\.md#codexomx-permission-mechanism/u,
    ],
    ['session-continuity.md', /adapters\/codex-diagnostics\.md#diagnostic-contract/u],
    ['request-intake/decisions.md', /Codex/u],
    ['visual-design/figma-mcp-evidence.md', /Codex/u],
  ])
    assert.match(
      readFileSync(resolve(root, 'docs/development/agent-workflows', path), 'utf8'),
      pattern,
    );
  const adapterIndex = readFileSync(
    resolve(root, 'docs/development/agent-workflows/adapters/README.md'),
    'utf8',
  );
  assert.match(adapterIndex, /모든 adapter를 기본 입력으로 읽지/u);
  assert.match(adapterIndex, /등록 전 Codex fallback 없음/u);
  assert.match(adapterIndex, /static PASS만으로/u);
});

test('Codex mechanisms have a conditional canonical host owner after extraction', () => {
  const read = (path) =>
    readFileSync(resolve(root, 'docs/development/agent-workflows', path), 'utf8');
  assert.match(read('adapters/codex-native-registry.md'), /Codex\/OMX host 전용/u);
  assert.match(read('adapters/codex-diagnostics.md'), /Codex\/OMX 전용 호환 계약/u);
  assert.doesNotMatch(read('agent-execution-contract.md'), /\[auto_review\]\.policy/u);
  assert.doesNotMatch(read('session-continuity.md'), /"taskMatch"\s*:/u);
});
