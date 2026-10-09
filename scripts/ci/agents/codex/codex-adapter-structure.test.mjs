import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../../../..');
const ADAPTERS = 'docs/development/agent-workflows/adapters/';
const ENTRY = `${ADAPTERS}codex.md`;
const ENTRY_BUDGET = 24_000;
// Agent documents that may link the Codex adapter. The tree-wide link guard is agent-document-graph (docs/development);
// this suite does not list the tracked tree, so it reads these two directories only.
const LINKING_DIRECTORIES = ['docs/development/agent-workflows', 'docs/evidence/agent-workflows'];
// Each reference owns the headings moved out of the entry; the entry keeps the routine headings. Moved headings keep
// their wording so inbound anchors only change the file name.
const REFERENCES = {
  'codex-model-profiles.md': [
    '## Quality-gated model advice',
    '## Central profile migration boundary',
    '## Task model configuration and fresh loading',
    '## Suspension and Astra-only rollback',
  ],
  'codex-native-registry.md': [
    '## Subagent hook guardrail과 완료 관측',
    '## Codex/OMX permission mechanism',
  ],
  'codex-diagnostics.md': [
    '## Diagnostic contract',
    '### Identity and freshness',
    '### Bounded reads and failure handling',
  ],
  'codex-qualification.md': ['## Cross-host direct CLI reviewer (static boundary)'],
};
const KEPT = [
  '## 구조',
  '## Reference 문서',
  '## Repository workflow entry',
  '## Reasoning effort routing',
  '### Parent-high 운영과 quality stop',
  '## Routine task-model operation',
  '## Skill과 workflow routing',
  '## Visual skill scope',
  '### 저장소 root와 runtime state 위치',
  '## OMX 종료 기록 경계',
];

const read = (path) => readFileSync(resolve(root, path), 'utf8');
const hasHeading = (text, heading) => text.split('\n').includes(heading);
function section(text, heading) {
  const lines = text.split('\n');
  const start = lines.indexOf(heading);
  if (start < 0) return '';
  const level = heading.indexOf(' ');
  const end = lines.findIndex(
    (line, i) => i > start && /^#{1,6} /u.test(line) && line.indexOf(' ') <= level,
  );
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}
function reference(name) {
  const path = ADAPTERS + name;
  assert.ok(existsSync(resolve(root, path)), `${path}: missing`);
  return read(path);
}
function ownerPaths() {
  return new Set(
    JSON.parse(
      read('scripts/ci/agents/common/fixtures/workflow-document-owners.json'),
    ).documents.map((d) => d.path),
  );
}

test('the Codex entry stays within budget and links each reference, which links back and has an owner', () => {
  const entry = read(ENTRY);
  const size = Buffer.byteLength(entry);
  assert.ok(size <= ENTRY_BUDGET, `${ENTRY}: ${size} bytes > ${ENTRY_BUDGET}`);
  const owners = ownerPaths();
  const list = section(entry, '## Reference 문서');
  for (const name of Object.keys(REFERENCES)) {
    assert.ok(list.includes(`](./${name})`), `${ENTRY} Reference 문서 must link ${name}`);
    assert.ok(reference(name).includes('](./codex.md'), `${name} must link the entry`);
    assert.ok(owners.has(ADAPTERS + name), `${name} needs an owners fixture row`);
  }
});

test('moved Codex headings live only in their reference and kept headings only in the entry', () => {
  const entry = read(ENTRY);
  const texts = Object.fromEntries(Object.keys(REFERENCES).map((name) => [name, reference(name)]));
  for (const [name, headings] of Object.entries(REFERENCES))
    for (const heading of headings) {
      assert.ok(hasHeading(texts[name], heading), `${name}: ${heading}`);
      const words = heading.replace(/^#+ /u, '');
      assert.ok(
        !entry
          .split('\n')
          .some((line) => /^#{1,6} /u.test(line) && line.replace(/^#+ /u, '') === words),
        `entry still has ${heading}`,
      );
    }
  for (const heading of KEPT) {
    assert.ok(hasHeading(entry, heading), `entry lost ${heading}`);
    for (const [name, text] of Object.entries(texts))
      assert.ok(!hasHeading(text, heading), `${name} duplicates ${heading}`);
  }
});

test('no tracked document links a moved Codex heading through the entry', () => {
  const moved = Object.values(REFERENCES)
    .flat()
    .map((heading) =>
      heading
        .replace(/^#+ /u, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .replace(/\s/gu, '-'),
    );
  const files = LINKING_DIRECTORIES.flatMap((dir) =>
    readdirSync(resolve(root, dir), { recursive: true })
      .filter((name) => name.endsWith('.md'))
      .map((name) => join(dir, name)),
  );
  const stale = [];
  for (const path of files) {
    const text = read(path);
    for (const match of text.matchAll(/(?:^|[(/])codex\.md#([^)\s]+)/gmu))
      if (moved.includes(match[1])) stale.push(`${path}: codex.md#${match[1]}`);
    if (path === ENTRY)
      for (const match of text.matchAll(/\]\(#([^)\s]+)\)/gu))
        if (moved.includes(match[1])) stale.push(`${path}: #${match[1]}`);
  }
  assert.deepEqual(stale, []);
});
