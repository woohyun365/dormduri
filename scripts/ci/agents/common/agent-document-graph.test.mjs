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
// Review criteria documents follow one item format under the common QA owner; a capped list keeps
// them from growing into a ritual checklist, and tracked criteria never cite ignored local evidence.
const CRITERIA_DIR = 'docs/development/agent-workflows/review-criteria';
const CRITERIA_ITEM_CAP = 8;
test('review criteria documents are registered owners with capped, complete items', () => {
  const readme = `${CRITERIA_DIR}/README.md`;
  // Every criteria document the helper can select is checked, not only the ones that exist today.
  const criteria = markdownFiles(CRITERIA_DIR)
    .filter((path) => path !== readme)
    .sort();
  for (const path of [`${CRITERIA_DIR}/agent-workflow-tooling.md`, `${CRITERIA_DIR}/documents.md`])
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
  assert.match(readmeText, new RegExp(`${CRITERIA_ITEM_CAP}개`, 'u'));
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
    const items = prose(text)
      .split(/^(?=### [A-Z]\d+\. )/mu)
      .slice(1);
    assert.ok(
      items.length > 0 && items.length <= CRITERIA_ITEM_CAP,
      `${path}: ${items.length} items`,
    );
    const ids = items.map((item) => item.match(/^### ([A-Z]\d+)\. /u)[1]);
    assert.equal(new Set(ids).size, ids.length, `${path}: duplicate item id`);
    for (const item of items)
      for (const field of [
        /^- 질문: \S/mu,
        /^- 기본 severity: `(?:critical|high|medium|low)`/mu,
        /^- 적용 조건: \S/mu,
        /^- 결함 패턴: \S/mu,
      ])
        assert.match(item, field, `${path} ${item.split('\n')[0]}`);
    assert.doesNotMatch(
      text,
      /\.artifacts\/|\.plans\/|\.local-docs\//u,
      `${path} cites ignored evidence`,
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
