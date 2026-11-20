import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import { anchors, links as markdownLinks, prose } from '../../../agents/common/markdown-links.mjs';
import { matchPathGlob } from '../../../agents/common/review-criteria-selection.mjs';
import { workflowGraph, validateWorkflowGraph } from '../../../agents/common/workflow-entry.mjs';
import { parseExemptionTable } from '../../lifecycle/area-criteria-check.mjs';
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
  'web-be-domain-model-invariant',
  'web-be-api-design-contract',
  'web-be-authn-authz',
  'web-be-application-architecture',
  'web-be-transaction-concurrency-idempotency',
  'web-be-background-integration-performance',
  'web-db-schema-modeling',
  'web-db-migration-seed-compatibility',
  'web-db-index-query',
  'web-db-integrity-retention-lifecycle',
  'web-infra-topology-runtime-config',
  'web-infra-ci-cd',
  'web-infra-observability',
  'web-infra-data-durability-recovery',
  'web-infra-capacity-cost-supply-chain',
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
  const keys = bindingKeys(readFileSync(resolve(root, BINDING_DOC), 'utf8'));
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
      // Exactly the seven fields and then the optional selection lines: no unknown or repeated line.
      assert.deepEqual(
        criteriaItemViolations(item, keys),
        [],
        `${path} ${item.split('\n')[0]}: field lines`,
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
    'be.md',
    {
      prefix: 'web-be-',
      sublayers: [
        'domain-model-invariant',
        'api-design-contract',
        'authn-authz',
        'application-architecture',
        'transaction-concurrency-idempotency',
        'background-integration-performance',
      ],
    },
  ],
  [
    'db.md',
    {
      prefix: 'web-db-',
      sublayers: [
        'schema-modeling',
        'migration-seed-compatibility',
        'index-query',
        'integrity-retention-lifecycle',
      ],
    },
  ],
  [
    'infra.md',
    {
      prefix: 'web-infra-',
      sublayers: [
        'topology-runtime-config',
        'ci-cd',
        'observability',
        'data-durability-recovery',
        'capacity-cost-supply-chain',
      ],
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
  'sensor',
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
// An item may end with two selection lines after the seven fields: `- trigger:` then `- 센서:`, each at
// most once. Their values are binding references only. A sensor reference names a row of the binding
// document's `## 센서` table, which owns the target, the command and the timing of that check.
const bindingKeys = (text) =>
  new Set([...text.matchAll(/^\| `([^`]+)` +\|/gmu)].map((match) => match[1]));
const criteriaItemBlocks = (text) =>
  prose(text)
    .split(/^(?=### [A-Z]\d+\. )/mu)
    .slice(1);
// Top-level field lines of one item; an indented line continues the field above it.
function itemFields(item) {
  const fields = [];
  for (const line of item.split('\n').slice(1)) {
    if (!line.trim()) continue;
    if (/^\s/u.test(line) && fields.length) fields.at(-1).value += ` ${line.trim()}`;
    else {
      const field = line.match(/^- ([^:]+): ?(.*)$/u);
      fields.push({ label: field?.[1] ?? line, value: field?.[2] ?? '' });
    }
  }
  return fields;
}
const SELECTION_LABELS = ['trigger', '센서'];
const SELECTION_KINDS = { trigger: ['repo-structure'], 센서: ['sensor'] };
const BINDING_REFERENCES =
  /^\{\{binding:[a-z-]+\.[a-z0-9-]+\}\}(?:, \{\{binding:[a-z-]+\.[a-z0-9-]+\}\})*$/u;
function criteriaItemViolations(item, keys) {
  const fields = itemFields(item);
  const labels = fields.map((field) => field.label);
  const selected = (label) => SELECTION_LABELS.includes(label);
  const violations = [];
  if (labels.filter((label) => !selected(label)).join('|') !== CRITERIA_LABELS.join('|'))
    violations.push('fields must be exactly the seven lines');
  const selection = labels.filter(selected);
  if (new Set(selection).size !== selection.length)
    violations.push('a selection line appears twice');
  const first = labels.findIndex(selected);
  const order = [...new Set(selection)].map((label) => SELECTION_LABELS.indexOf(label));
  if (
    (first >= 0 && !labels.slice(first).every(selected)) ||
    order.some((at, index) => index > 0 && at < order[index - 1])
  )
    violations.push('selection lines must follow the seven lines as trigger then 센서');
  for (const { label, value } of fields.filter((field) => selected(field.label))) {
    if (!BINDING_REFERENCES.test(value)) {
      violations.push(`${label} value must be binding references only`);
      continue;
    }
    for (const [, key] of value.matchAll(/\{\{binding:([^}]+)\}\}/gu)) {
      if (!SELECTION_KINDS[label].includes(key.split('.')[0]))
        violations.push(`${label} cannot reference ${key}`);
      else if (!keys.has(key)) violations.push(`${key} is not in the binding document`);
    }
  }
  return violations;
}
const criteriaDocumentViolations = (text, keys) =>
  criteriaItemBlocks(text).flatMap((item) =>
    criteriaItemViolations(item, keys).map(
      (violation) => `${item.match(/^### ([A-Z]\d+)\. /u)[1]}: ${violation}`,
    ),
  );
// A command cell names where the check runs: a root package script as a `pnpm <script>` code span, or a
// link to a file. A link to a workflow file carries one of its step names as the link text.
function executionPointViolations(command, repo) {
  const link = /\[`?([^\]`]+)`?\]\(([^)\s]+)\)/gu;
  const links = [...command.matchAll(link)].map(([, text, target]) => ({ text, target }));
  const spans = [...command.replace(link, '').matchAll(/`([^`]+)`/gu)].map(([, code]) => code);
  const violations = [];
  if (links.length + spans.length === 0) violations.push('명령 names no execution point');
  for (const code of spans) {
    const script = code.match(/^pnpm ([a-z0-9:-]+)$/u)?.[1];
    if (!script) violations.push(`\`${code}\` is not a root package script call`);
    else if (!repo.hasScript(script)) violations.push(`package script ${script} is missing`);
  }
  for (const { text, target } of links) {
    const path = repo.resolveLink(target);
    if (!repo.hasFile(path)) violations.push(`${path} is missing`);
    else if (path.startsWith('.github/workflows/') && !repo.hasStep(path, text))
      violations.push(`${path} has no step named ${text}`);
  }
  return violations;
}
const SENSOR_HEADER = ['키', '대상', '명령', '실행 시점', '지점과 상한'];
const SENSOR_TIMINGS = ['편집', 'commit', 'CI', '리뷰', '운영'];
// 대상 names what the check covers: binding path keys (`repo-structure.*`) that exist, or globs. 지점과 상한 is
// written only by a row that runs at 편집 and is `-` otherwise.
function sensorTableViolations(binding, repo) {
  const keys = bindingKeys(binding);
  const section = prose(binding)
    .split(/^(?=## )/mu)
    .find((block) => block.startsWith('## 센서\n'));
  if (!section) return [];
  const [header, , ...rows] = section.split('\n').filter((line) => line.startsWith('|'));
  if (cells(header ?? '||').join('|') !== SENSOR_HEADER.join('|'))
    return [`센서 table header must be ${SENSOR_HEADER.join('|')}`];
  const violations = [];
  const seen = new Set();
  for (const row of rows) {
    const [key, target, command, timing, limit] = cells(row);
    const id = key.match(/^`(sensor\.[a-z0-9-]+)`$/u)?.[1];
    if (!id || cells(row).length !== SENSOR_HEADER.length) {
      violations.push(`malformed sensor row ${key}`);
      continue;
    }
    if (seen.has(id)) violations.push(`${id} appears twice`);
    seen.add(id);
    const targets = [...target.matchAll(/`([^`]+)`/gu)].map(([, code]) => code);
    if (targets.length === 0) violations.push(`${id}: 대상 names no binding path key or glob`);
    for (const code of targets) {
      const kind = code.match(/^([a-z-]+)\.[a-z0-9-]+$/u)?.[1];
      if (!kind || !BINDING_KINDS.has(kind)) continue;
      if (kind !== 'repo-structure') violations.push(`${id}: 대상 cannot reference ${code}`);
      else if (!keys.has(code))
        violations.push(`${id}: 대상 key ${code} is not in the binding document`);
    }
    if (!timing || timing.split(', ').some((value) => !SENSOR_TIMINGS.includes(value)))
      violations.push(`${id}: 실행 시점 must be among ${SENSOR_TIMINGS.join('·')}`);
    const edit = timing.split(', ').includes('편집');
    if (!edit && limit !== '-')
      violations.push(`${id}: 지점과 상한 must be - unless 실행 시점 has 편집`);
    if (edit && (!limit || limit === '-'))
      violations.push(`${id}: 지점과 상한 is required when 실행 시점 has 편집`);
    violations.push(
      ...executionPointViolations(command, repo).map((violation) => `${id}: ${violation}`),
    );
  }
  return violations;
}
// Where a sensor row's command runs: the root package scripts, files by link from the binding document
// and the step names of a workflow file.
const repository = {
  hasScript: (name) =>
    Object.hasOwn(JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts, name),
  resolveLink: (target) =>
    relative(root, resolve(root, dirname(BINDING_DOC), target.split('#')[0]))
      .split(sep)
      .join('/'),
  hasFile: (path) => !path.startsWith('..') && existsSync(resolve(root, path)),
  hasStep: (path, name) =>
    readFileSync(resolve(root, path), 'utf8')
      .split('\n')
      .some((line) => line.trim() === `- name: ${name}`),
};
const FIXTURE_ITEM = [
  '### X1. 예시 항목',
  '',
  '- 질문: 예시 변경이 예시 규칙을 지키는가?',
  '- 기본 severity: `medium`',
  '- 적용 조건: 예시 변경',
  '- 결함 패턴: 예시 결함',
  '- PASS 근거: 예시 관측',
  '- 지침: 예시 지침',
  '- 피함: 예시 피함',
];
const fixtureItem = (...selection) => [...FIXTURE_ITEM, ...selection].join('\n');
const fixtureSensorRow = ({
  key = '`sensor.lint`',
  command = '`pnpm lint`, [`Static checks`](../../../../.github/workflows/example.yml)',
  timing = 'commit, CI',
  target = '`repo-structure.example`',
  limit = '-',
} = {}) => `| ${key} | ${target} | ${command} | ${timing} | ${limit} |`;
const fixtureBinding = (...rows) =>
  [
    '| 키 | 값 |',
    '| --- | --- |',
    '| `repo-structure.example` | `example/**` |',
    '',
    '## 센서',
    '',
    '| 키 | 대상 | 명령 | 실행 시점 | 지점과 상한 |',
    '| --- | --- | --- | --- | --- |',
    ...(rows.length ? rows : [fixtureSensorRow()]),
    '',
  ].join('\n');
const fixtureRepository = {
  hasScript: (name) => name === 'lint',
  resolveLink: (target) => target.replace(/^(?:\.\.\/)+/u, ''),
  hasFile: (path) => ['.github/workflows/example.yml', '.husky/pre-commit'].includes(path),
  hasStep: (path, name) => name === 'Static checks',
};
const fixtureKeys = bindingKeys(fixtureBinding());
const TRIGGER_LINE = '- trigger: {{binding:repo-structure.example}}';
const SENSOR_LINE = '- 센서: {{binding:sensor.lint}}';
test('an item accepts selection lines after the seven fields, trigger before 센서', () => {
  for (const lines of [[TRIGGER_LINE, SENSOR_LINE], [TRIGGER_LINE], [SENSOR_LINE]])
    assert.deepEqual(criteriaItemViolations(fixtureItem(...lines), fixtureKeys), [], lines.join());
});
test('a selection line before a field or 센서 before trigger is out of order', () => {
  const order = ['selection lines must follow the seven lines as trigger then 센서'];
  assert.deepEqual(
    criteriaItemViolations(fixtureItem(SENSOR_LINE, TRIGGER_LINE), fixtureKeys),
    order,
  );
  const early = [...FIXTURE_ITEM.slice(0, -1), SENSOR_LINE, FIXTURE_ITEM.at(-1)].join('\n');
  assert.deepEqual(criteriaItemViolations(early, fixtureKeys), order);
});
test('a repeated selection line is refused apart from an unknown field', () => {
  assert.deepEqual(criteriaItemViolations(fixtureItem(SENSOR_LINE, SENSOR_LINE), fixtureKeys), [
    'a selection line appears twice',
  ]);
  assert.deepEqual(criteriaItemViolations(fixtureItem('- 메모: 다른 필드'), fixtureKeys), [
    'fields must be exactly the seven lines',
  ]);
});
test('a selection value that writes a repository value instead of a binding reference is refused', () => {
  const violations = (line) => criteriaItemViolations(fixtureItem(line), fixtureKeys);
  assert.deepEqual(violations('- 센서: `pnpm lint`'), [
    '센서 value must be binding references only',
  ]);
  assert.deepEqual(violations('- trigger: `example/**`'), [
    'trigger value must be binding references only',
  ]);
  assert.deepEqual(violations(`${SENSOR_LINE},\n  \`pnpm lint\``), [
    '센서 value must be binding references only',
  ]);
});
test('a selection value must name a binding row of its own kind', () => {
  const violations = (line) => criteriaItemViolations(fixtureItem(line), fixtureKeys);
  assert.deepEqual(violations('- 센서: {{binding:sensor.typecheck}}'), [
    'sensor.typecheck is not in the binding document',
  ]);
  assert.deepEqual(violations('- trigger: {{binding:repo-structure.missing}}'), [
    'repo-structure.missing is not in the binding document',
  ]);
  assert.deepEqual(violations('- 센서: {{binding:repo-structure.example}}'), [
    '센서 cannot reference repo-structure.example',
  ]);
  assert.deepEqual(violations('- trigger: {{binding:sensor.lint}}'), [
    'trigger cannot reference sensor.lint',
  ]);
});
const sensorRowViolations = (row) => sensorTableViolations(fixtureBinding(row), fixtureRepository);
test('a sensor row timing outside the five values is refused', () => {
  assert.deepEqual(sensorTableViolations(fixtureBinding(), fixtureRepository), []);
  assert.deepEqual(sensorRowViolations(fixtureSensorRow({ timing: 'commit, 배포' })), [
    'sensor.lint: 실행 시점 must be among 편집·commit·CI·리뷰·운영',
  ]);
  assert.deepEqual(sensorRowViolations(fixtureSensorRow({ timing: '' })), [
    'sensor.lint: 실행 시점 must be among 편집·commit·CI·리뷰·운영',
  ]);
});
test('a sensor row whose command names no execution point that exists is refused', () => {
  assert.deepEqual(sensorRowViolations(fixtureSensorRow({ command: '`pnpm missing`' })), [
    'sensor.lint: package script missing is missing',
  ]);
  assert.deepEqual(sensorRowViolations(fixtureSensorRow({ command: '`npx eslint .`' })), [
    'sensor.lint: `npx eslint .` is not a root package script call',
  ]);
  assert.deepEqual(
    sensorRowViolations(fixtureSensorRow({ command: '[hook](../../../../.husky/missing)' })),
    ['sensor.lint: .husky/missing is missing'],
  );
  assert.deepEqual(
    sensorRowViolations(
      fixtureSensorRow({ command: '[`Renamed step`](../../../../.github/workflows/example.yml)' }),
    ),
    ['sensor.lint: .github/workflows/example.yml has no step named Renamed step'],
  );
  assert.deepEqual(sensorRowViolations(fixtureSensorRow({ command: '저장소 lint' })), [
    'sensor.lint: 명령 names no execution point',
  ]);
});
test('a sensor row target that names no binding path key or glob is refused', () => {
  const violations = (target) => sensorRowViolations(fixtureSensorRow({ target }));
  assert.deepEqual(violations('`example/**`, `repo-structure.example`(예시 설명)'), []);
  assert.deepEqual(violations('`repo-structure.missing`'), [
    'sensor.lint: 대상 key repo-structure.missing is not in the binding document',
  ]);
  assert.deepEqual(violations('`sensor.lint`'), ['sensor.lint: 대상 cannot reference sensor.lint']);
  assert.deepEqual(violations('예시 화면'), [
    'sensor.lint: 대상 names no binding path key or glob',
  ]);
});
test('a sensor row writes its point and limit only when it runs at 편집', () => {
  const violations = (timing, limit) => sensorRowViolations(fixtureSensorRow({ timing, limit }));
  assert.deepEqual(violations('편집, CI', '직후'), []);
  assert.deepEqual(violations('commit, CI', '직후'), [
    'sensor.lint: 지점과 상한 must be - unless 실행 시점 has 편집',
  ]);
  assert.deepEqual(violations('편집, CI', '-'), [
    'sensor.lint: 지점과 상한 is required when 실행 시점 has 편집',
  ]);
});
// The fixture repository above answers by name only. This test runs the adapter that reads the repository
// itself against the binding rows, so a script, file or step the rows name cannot go missing unnoticed.
test('the repository adapter refuses a script, file or workflow step the binding rows do not have', () => {
  const binding = readFileSync(resolve(root, BINDING_DOC), 'utf8');
  const section = binding.slice(binding.indexOf('\n## 센서\n'));
  const script = section.match(/`pnpm ([a-z0-9:-]+)`/u);
  const step = section.match(/\[`([^`\]]+)`\]\(([^)\s]*\.github\/workflows\/([^)\s/]+))\)/u);
  assert.ok(script && step, 'the 센서 table must name a package script and a workflow step');
  const changed = (from, to) => {
    const text = binding.replace(from, to);
    assert.notEqual(text, binding, from);
    return sensorTableViolations(text, repository);
  };
  assert.match(
    changed(script[0], '`pnpm no-such-script`').join('\n'),
    /^sensor\.[a-z0-9-]+: package script no-such-script is missing$/u,
  );
  assert.match(
    changed(step[0], step[0].replace(step[1], 'No such step')).join('\n'),
    /^sensor\.[a-z0-9-]+: \.github\/workflows\/\S+ has no step named No such step$/u,
  );
  assert.match(
    changed(step[0], step[0].replace(step[3], 'no-such-workflow.yml')).join('\n'),
    /^sensor\.[a-z0-9-]+: \.github\/workflows\/no-such-workflow\.yml is missing$/u,
  );
});
test('a sensor table with a malformed key, a repeated key or another header is refused', () => {
  assert.deepEqual(sensorRowViolations(fixtureSensorRow({ key: '`lint`' })), [
    'malformed sensor row `lint`',
  ]);
  assert.deepEqual(
    sensorTableViolations(
      fixtureBinding(fixtureSensorRow(), fixtureSensorRow()),
      fixtureRepository,
    ),
    ['sensor.lint appears twice'],
  );
  assert.deepEqual(
    sensorTableViolations(fixtureBinding().replace('| 지점과 상한 |', '|'), fixtureRepository),
    ['센서 table header must be 키|대상|명령|실행 시점|지점과 상한'],
  );
});
test('every criteria document is checked for selection lines, documents.md included', () => {
  const documents = criteriaDocuments();
  for (const id of ['documents', 'agent-workflow-tooling', 'swe'])
    assert.ok(documents.includes(`${CRITERIA_DIR}/${id}.md`), id);
  const text = readFileSync(resolve(root, `${CRITERIA_DIR}/documents.md`), 'utf8');
  const first = criteriaItemBlocks(text)[0];
  const id = first.match(/^### ([A-Z]\d+)\. /u)[1];
  const changed = text.replace(
    first.trimEnd(),
    `${first.trimEnd()}\n- 센서: {{binding:sensor.no-such-row}}`,
  );
  assert.notEqual(changed, text);
  assert.deepEqual(criteriaDocumentViolations(changed, fixtureKeys), [
    `${id}: sensor.no-such-row is not in the binding document`,
  ]);
});
test('items without selection lines and the repository documents pass the selection line checks', () => {
  assert.deepEqual(criteriaItemViolations(fixtureItem(), fixtureKeys), []);
  const binding = readFileSync(resolve(root, BINDING_DOC), 'utf8');
  assert.deepEqual(sensorTableViolations(binding, repository), []);
  const keys = bindingKeys(binding);
  let items = 0;
  for (const path of criteriaDocuments()) {
    const text = readFileSync(resolve(root, path), 'utf8');
    items += criteriaItemBlocks(text).length;
    assert.deepEqual(criteriaDocumentViolations(text, keys), [], path);
  }
  assert.ok(items > 0, 'the criteria documents must have items');
});
test('the binding document has a 센서 table whose rows criteria items reference', () => {
  const binding = readFileSync(resolve(root, BINDING_DOC), 'utf8');
  assert.match(prose(binding), /^## 센서$/mu, `${BINDING_DOC}: '## 센서' section is missing`);
  const referenced = new Set(
    criteriaDocuments().flatMap((path) =>
      criteriaItemBlocks(readFileSync(resolve(root, path), 'utf8')).flatMap((item) =>
        itemFields(item)
          .filter((field) => field.label === '센서')
          .flatMap((field) => [...field.value.matchAll(/\{\{binding:([^}]+)\}\}/gu)])
          .map((match) => match[1]),
      ),
    ),
  );
  assert.ok(referenced.size > 0, 'no criteria item references a sensor row');
  for (const key of referenced) assert.ok(bindingKeys(binding).has(key), key);
});
// #778: the Web build·lint·test configuration row of the area exemption table also covers the React
// Compiler configuration that sits next to the Vitest configuration it already lists.
test('the configuration exemption row covers the React Compiler configuration', () => {
  const rows = parseExemptionTable(readFileSync(resolve(root, BINDING_DOC), 'utf8'), BINDING_DOC);
  const row = rows.find((candidate) => candidate.reason.startsWith('build·lint·test 설정'));
  assert.ok(row, `${BINDING_DOC}: build·lint·test 설정 exemption row is missing`);
  const vitest = row.include.find((glob) => glob.endsWith('/vitest.config.ts'));
  assert.ok(vitest, 'the row must list the Vitest configuration');
  const path = `${dirname(vitest)}/react-compiler.config.ts`;
  assert.ok(
    row.include.some((glob) => matchPathGlob(path, glob)) &&
      !row.exclude.some((glob) => matchPathGlob(path, glob)),
    `no glob of the build·lint·test 설정 row matches ${path}`,
  );
});
// The binding document records the value the repository chose for every `framework-pattern` and
// `code-pattern` pack decision; other levels keep theirs in the decision record or a policy document.
// A decision whose value differs by area takes one `<id>/<area>` row per area, so a dropped area row
// keeps the id set and stays a review item.
const CHOSEN_LEVEL = /^- 수준: `(?:framework-pattern|code-pattern)`$/mu;
const CHOSEN_HEADER = ['결정', '상태', '고른 값', '근거', '메모'];
const cells = (line) =>
  line
    .trim()
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
// A source link resolves when its file exists and a Markdown fragment names a heading of that file.
const sourceResolves = (x) =>
  existsSync(resolve(root, x.path)) &&
  (!x.fragment ||
    !x.path.endsWith('.md') ||
    anchors(readFileSync(resolve(root, x.path), 'utf8')).has(x.fragment));
// Criteria item references in a table cell are `<document>.md <ID>` code spans; any other mention of a
// `.md` name is a malformed reference, not prose to skip.
const criteriaReferences = (cell, label) => {
  const references = [...cell.matchAll(/`([a-z0-9-]+\.md) ([A-Z]\d+)`/gu)];
  assert.equal(
    cell.match(/\.md\b/gu)?.length ?? 0,
    references.length,
    `${label}: criteria references must be \`<document>.md <ID>\` code spans`,
  );
  return references;
};
test('binding chosen-value table covers the framework and code pattern decisions', () => {
  const text = prose(readFileSync(resolve(root, BINDING_DOC), 'utf8'));
  const section = text.split(/^(?=## )/mu).find((block) => block.startsWith('## 고른 값\n'));
  assert.ok(section, `${BINDING_DOC}: '## 고른 값' section is missing`);
  const [header, , ...rows] = section.split('\n').filter((line) => line.startsWith('|'));
  assert.deepEqual(cells(header ?? '||'), CHOSEN_HEADER, `${BINDING_DOC}: 고른 값 table header`);
  const decisions = new Set();
  for (const name of PACK_LAYERS.keys())
    for (const block of prose(readFileSync(resolve(root, `${PACK_DIR}/${name}`), 'utf8'))
      .split(/^(?=#### )/mu)
      .slice(1))
      if (CHOSEN_LEVEL.test(block.split(/^(?=#{2,3} )/mu)[0]))
        decisions.add(block.match(/^#### (\S+)$/mu)[1]);
  const items = criteriaItems();
  const ids = new Set(),
    seen = new Set();
  for (const row of rows) {
    const [decision, status, , source, memo] = cells(row);
    assert.equal(cells(row).length, CHOSEN_HEADER.length, `${BINDING_DOC}: ${row}`);
    const id = decision.match(/^`([a-z0-9.-]+)(?:\/[a-z0-9-]+)?`$/u)?.[1];
    assert.ok(id, `${BINDING_DOC}: malformed decision cell ${decision}`);
    assert.ok(!seen.has(decision), `${BINDING_DOC}: ${decision} appears twice`);
    seen.add(decision);
    ids.add(id);
    assert.ok(['known', 'unknown'].includes(status), `${BINDING_DOC} ${decision}: 상태 ${status}`);
    if (status === 'known')
      assert.ok(
        markdownLinks(root, BINDING_DOC, source).some(sourceResolves),
        `${BINDING_DOC} ${decision}: a known value needs a source link that resolves`,
      );
    else assert.match(memo, /재검토: \S/u, `${BINDING_DOC} ${decision}: unknown needs 재검토 시점`);
    for (const [, file, item] of criteriaReferences(memo, `${BINDING_DOC} ${decision}`))
      assert.ok(
        (items.get(`${CRITERIA_DIR}/${file}`) ?? []).some((x) => x.id === item),
        `${BINDING_DOC} ${decision}: ${file} ${item} is not a criteria item`,
      );
  }
  assert.deepEqual(
    [...ids].sort(),
    [...decisions].sort(),
    `${BINDING_DOC}: 고른 값 rows must be the framework-pattern and code-pattern pack decisions`,
  );
});
// Criteria items name some repository rules only in general words ("저장소 공통 envelope", "저장소의 명명
// 규약"); the binding document's `저장소 규약` table gives each such rule or fact its source and the items it serves.
const CONVENTION_HEADER = ['사실', '원본', '관련 기준 항목'];
test('binding repository convention table resolves sources and criteria items', () => {
  const text = prose(readFileSync(resolve(root, BINDING_DOC), 'utf8'));
  const section = text.split(/^(?=## )/mu).find((block) => block.startsWith('## 저장소 규약\n'));
  assert.ok(section, `${BINDING_DOC}: '## 저장소 규약' section is missing`);
  const [header, , ...rows] = section.split('\n').filter((line) => line.startsWith('|'));
  assert.deepEqual(
    cells(header ?? '||'),
    CONVENTION_HEADER,
    `${BINDING_DOC}: 저장소 규약 table header`,
  );
  assert.ok(rows.length > 0, `${BINDING_DOC}: 저장소 규약 table has no rows`);
  const items = criteriaItems();
  for (const row of rows) {
    const [fact, source, criteria] = cells(row);
    assert.equal(cells(row).length, CONVENTION_HEADER.length, `${BINDING_DOC}: ${row}`);
    assert.ok(
      markdownLinks(root, BINDING_DOC, source).some(sourceResolves),
      `${BINDING_DOC} ${fact}: 원본 needs a link that resolves`,
    );
    const references = criteriaReferences(criteria, `${BINDING_DOC} ${fact}`);
    assert.ok(references.length > 0, `${BINDING_DOC} ${fact}: 관련 기준 항목 is empty`);
    for (const [, file, item] of references)
      assert.ok(
        (items.get(`${CRITERIA_DIR}/${file}`) ?? []).some((x) => x.id === item),
        `${BINDING_DOC} ${fact}: ${file} ${item} is not a criteria item`,
      );
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
