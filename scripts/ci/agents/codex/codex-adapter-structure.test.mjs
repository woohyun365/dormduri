import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../../../..');
const ADAPTERS = 'docs/development/agent-workflows/adapters/';
const ENTRY = `${ADAPTERS}codex.md`;
const ENTRY_BUDGET = 24_000;
// Agent documents that may link the Codex adapter. This suite does not list the tracked tree, so it reads these two
// directories only; agent-document-graph resolves every link and anchor under docs/development, and the runner sweeps
// the whole tree for links to moved anchors.
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
  'codex-qualification.md': [
    '## Cross-host direct CLI reviewer (static boundary)',
    '## Native live pilot',
  ],
};
// Child own-turn model/effort a live receipt observed for each candidate row's roles (codex-cli version). The
// observation column records evidence only; routine status stays with the profile decision.
const OBSERVED = {
  extract: ['`knu_explorer_xhigh`', '`gpt-6-luna`/xhigh', '0.160.0'],
  'standard-read': ['`knu_explorer`', '`gpt-6.1-sol`/high', '0.162.0', '`knu_researcher` 미관측'],
  'elevated-read': ['미관측'],
  'standard-build': ['`knu_executor`', '`gpt-6.1-sol`/high', '0.161.0'],
  'elevated-build': ['`knu_executor_xhigh`', '`gpt-6.1-sol`/xhigh', '0.162.1'],
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
  assert.match(
    list,
    /codex-qualification\.md\)[^\n]*\n?[^\n]*live pilot/u,
    'Reference 문서 must name the live pilot',
  );
});

test('the candidate profile table records each row own-turn observation without changing routine status', () => {
  const advice = section(reference('codex-model-profiles.md'), '## Quality-gated model advice');
  const rows = advice.split('\n').filter((line) => line.startsWith('|'));
  const header = rows[0]?.split('|').map((cell) => cell.trim()) ?? [];
  const column = header.indexOf('관측(own-turn)');
  assert.ok(column > 0, 'candidate table needs a 관측(own-turn) column');
  for (const [profile, tokens] of Object.entries(OBSERVED)) {
    const row = rows.find((line) => line.split('|')[1]?.trim() === `\`${profile}\``);
    assert.ok(row, `candidate table lost ${profile}`);
    const cell = row.split('|')[column].trim();
    for (const token of tokens)
      assert.ok(cell.includes(token), `${profile} observation lacks ${token}`);
  }
  assert.match(
    advice,
    /관측 열은[^.]*routine 상태를 바꾸지 않/u,
    'observation column must not change routine status',
  );
});

test('the native live pilot fixes the start, the scratch home and the receipt rules', () => {
  const pilot = section(reference('codex-qualification.md'), '## Native live pilot');
  assert.ok(pilot, 'codex-qualification.md needs ## Native live pilot');
  for (const token of [
    '-m gpt-6-astra',
    '-c model_reasoning_effort="high"',
    '-s ',
    'CODEX_HOME',
    'auth.json',
    '~/.codex/config.toml',
    '~/.codex/AGENTS.md',
    'digest',
    'send-keys -l',
    'capture-pane',
    'Enter',
    '--dangerously-bypass',
    'linked worktree',
  ])
    assert.ok(pilot.includes(token), `pilot lacks ${token}`);
  for (const rule of [
    /세션 안에서[^.]*model·effort[^.]*바꾸지 않/u,
    /지시[^.]*파일/u,
    /hook 기록기[^.]*사본/u,
    /exit 값[^.]*직접/u,
    /역할 pin[^.]*Parent[^.]*다른/u,
    /trust[^.]*다시/u,
  ])
    assert.match(pilot, rule, `pilot lacks ${rule}`);
  assert.ok(pilot.includes('](./codex.md'), 'pilot section must link the entry');
});

test('Parent judgment and quality stop follow the common review rounds without a parent-adjudication split', () => {
  const parent = section(read(ENTRY), '### Parent-high 운영과 quality stop');
  assert.ok(
    parent.includes('](../qa.md#리뷰-회차)'),
    'Parent-high must link the common review rounds',
  );
  const registry = reference('codex-native-registry.md');
  assert.match(
    registry,
    /`parent-adjudication`[^.]*terminal reviewer[^.]*두지 않/u,
    'registry must record why Codex keeps no parent-adjudication split',
  );
  assert.ok(
    registry.includes('](../qa.md#리뷰-회차)'),
    'registry must link the common review rounds',
  );
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

test('no agent workflow or evidence document links a moved Codex heading through the entry', () => {
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
      .map((name) => `${dir}/${name.split(sep).join('/')}`),
  );
  const stale = [];
  for (const path of files) {
    const text = read(path);
    for (const match of text.matchAll(/(?:^|[(/\s])codex\.md#([^)\s]+)/gmu))
      if (moved.includes(decodeURIComponent(match[1]))) stale.push(`${path}: codex.md#${match[1]}`);
    if (path === ENTRY)
      for (const match of text.matchAll(/\]\(#([^)\s]+)\)/gu))
        if (moved.includes(decodeURIComponent(match[1]))) stale.push(`${path}: #${match[1]}`);
  }
  assert.deepEqual(stale, []);
});
