import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const ADAPTERS = 'docs/development/agent-workflows/adapters/';
const ENTRY = `${ADAPTERS}claude-code.md`;
const TOOLING = 'docs/development/troubleshooting/tooling/';
const ENTRY_BUDGET = 24_000;
// Each reference owns the headings moved out of the entry; the entry keeps the routine headings.
const REFERENCES = {
  'claude-native-registry.md': [
    '## 일반 interactive auto 세션',
    '### 운영 보장과 제한',
    '### 프로젝트 역할과 실제 권한',
  ],
  'claude-same-host-review.md': ['## Same-host independent review'],
  'claude-model-profiles.md': [
    '## Finite native-subagent model candidates',
    '### 요청·차단·관측의 세 경계',
    '### 결과와 observation 경계',
  ],
  'claude-qualification.md': [
    '## Cross-host direct CLI reviewer (static boundary)',
    '## Bounded fresh-host qualification',
  ],
};
const KEPT = [
  '## Loading and scope',
  '## Routine operation',
  '## Recovery',
  '## Parent 운영과 quality stop',
  '## OMC 공존과 skill routing',
  '## Plan continuity',
  '### 저장소 root와 runtime state 위치',
  '## Project visual skills',
];

const read = (path) => readFileSync(resolve(root, path), 'utf8');
const flat = (text) => text.replace(/\s+/gu, ' ');
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
// A top-level bullet runs until the next top-level bullet or the end of its section.
function bullet(text, prefix) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(prefix));
  if (start < 0) return '';
  const end = lines.findIndex((line, i) => i > start && /^- /u.test(line));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}
function reference(name) {
  const path = ADAPTERS + name;
  assert.ok(existsSync(resolve(root, path)), `${path}: missing`);
  return read(path);
}
function ownerPaths() {
  return new Set(
    JSON.parse(read('scripts/ci/fixtures/workflow-document-owners.json')).documents.map(
      (d) => d.path,
    ),
  );
}

test('the entry stays within budget and links each reference, which links back and has an owner', () => {
  const entry = read(ENTRY);
  const size = Buffer.byteLength(entry);
  assert.ok(size <= ENTRY_BUDGET, `${ENTRY}: ${size} bytes > ${ENTRY_BUDGET}`);
  const owners = ownerPaths();
  for (const name of Object.keys(REFERENCES)) {
    assert.ok(entry.includes(`](./${name}`), `${ENTRY} must link ${name}`);
    assert.ok(reference(name).includes('](./claude-code.md'), `${name} must link the entry`);
    assert.ok(owners.has(ADAPTERS + name), `${name} needs an owners fixture row`);
  }
});

test('moved headings live only in their reference and kept headings only in the entry', () => {
  const entry = read(ENTRY);
  const texts = Object.fromEntries(Object.keys(REFERENCES).map((name) => [name, reference(name)]));
  for (const [name, headings] of Object.entries(REFERENCES))
    for (const heading of headings) {
      assert.ok(hasHeading(texts[name], heading), `${name}: ${heading}`);
      assert.ok(!hasHeading(entry, heading), `entry still has ${heading}`);
    }
  for (const heading of KEPT) {
    assert.ok(hasHeading(entry, heading), `entry lost ${heading}`);
    for (const [name, text] of Object.entries(texts))
      assert.ok(!hasHeading(text, heading), `${name} duplicates ${heading}`);
  }
});

test('quality stop keeps only Claude-specific conditions and links the common rule', () => {
  const stop = flat(section(read(ENTRY), '## Parent 운영과 quality stop'));
  assert.ok(stop, 'quality stop section');
  for (const restated of [
    'Source·환경·권한·테스트 공백부터',
    '상향은 원인 입증이나 품질 회복 보장이 아닙니다',
  ])
    assert.ok(!stop.includes(restated), `restated common rule: ${restated}`);
  for (const kept of [
    '../orchestration.md#quality-stop',
    '연속 non-PASS',
    'Opus 5.5 high',
    'xhigh',
    'advisory',
  ])
    assert.ok(stop.includes(kept), `kept: ${kept}`);
});

test('the structure section names five layers without overstating permissions', () => {
  const structure = section(read(ENTRY), '## 구조');
  assert.ok(structure, 'entry needs a 구조 section');
  for (const layer of ['- `CLAUDE.md`', '- Skills', '- Subagents', '- Hooks', '- Permissions'])
    assert.ok(
      structure.split('\n').some((line) => line.startsWith(layer)),
      layer,
    );

  const permissions = flat(bullet(structure, '- Permissions'));
  for (const required of ['hard deny', '보안 경계가 아닙니다', 'gate로 쓰지 않습니다'])
    assert.ok(permissions.includes(required), `Permissions: ${required}`);
  assert.doesNotMatch(permissions, /classifier/iu);
  for (const sentence of permissions.split(/\.(?:\s|$)/u))
    assert.ok(!(/\bask\b/u.test(sentence) && sentence.includes('hard deny')), sentence);

  assert.ok(
    flat(bullet(structure, '- Auto mode classifier')).includes('보장이 아닙니다'),
    'classifier',
  );
});

test('positional pointers and see-also links reach the moved text', () => {
  const qualification = reference('claude-qualification.md');
  assert.ok(!qualification.includes('아래 native child'));
  assert.ok(qualification.includes('](./claude-native-registry.md'));
  const registry = reference('claude-native-registry.md');
  for (const stale of ['아래의 `independentReview`', '아래 task profile'])
    assert.ok(!registry.includes(stale), stale);
  for (const target of ['](./claude-same-host-review.md', '](./claude-model-profiles.md'])
    assert.ok(registry.includes(target), target);
  for (const name of ['claude-same-host-review.md', 'claude-model-profiles.md']) reference(name);

  const routine = flat(section(read(ENTRY), '## Routine operation'));
  assert.ok(routine.includes('규칙의 원본은 이 문서·reference 문서와'), 'routine source pointer');

  for (const [doc, text, target] of [
    [
      'claude-native-registration-and-review-rejections',
      'same-host 독립 review',
      'claude-same-host-review.md',
    ],
    [
      'claude-native-completion-observation-missing',
      '비동기 완료 수집',
      'claude-native-registry.md',
    ],
    ['claude-native-parent-concurrent-write', '등록·정산 절차', 'claude-native-registry.md'],
  ]) {
    const link = new RegExp(`\\[Claude Code adapter의 ${text}\\]\\(([^)]+)\\)`, 'u').exec(
      read(`${TOOLING}${doc}.md`),
    );
    assert.ok(link, `${doc}: ${text} link`);
    assert.ok(link[1].endsWith(`adapters/${target}`), `${doc}: ${link[1]}`);
  }
});
