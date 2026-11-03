import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { checkPlanShape, main } from '../../../agents/common/plan-shape-check.mjs';
// The revision classifier is read through the namespace so a missing export fails only its own tests.
import * as shape from '../../../agents/common/plan-shape-check.mjs';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const modulePath = resolve(repoRoot, 'scripts/agents/common/plan-shape-check.mjs');
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

const found = (text) => checkPlanShape(text).warnings.map(({ kind, line }) => `${kind}@${line}`);

// Header of `length` UTF-16 code units: the title line, '\n' and Hangul filler (three UTF-8 bytes per unit, so a
// byte count would differ), then the first `## ` heading.
function headerOf(length, title = '# Plan') {
  return `${title}\n${'가'.repeat(length - title.length - 1)}`;
}

function statusOf(length, field = 'Status') {
  const head = `- ${field}: proposed — `;
  return head + '나'.repeat(length - head.length);
}

function scratch() {
  const root = mkdtempSync(resolve(tmpdir(), 'plan-shape-'));
  temporary.push(root);
  return root;
}

function capture(argv, cwd) {
  const out = [];
  const err = [];
  const code = main(argv, { cwd, log: (line) => out.push(line), error: (line) => err.push(line) });
  return { code, out, err };
}

test('header가 4,000자이면 경고가 없고 4,001자이면 header-length 하나다', () => {
  assert.deepEqual(found(`${headerOf(4000)}\n## 1. 목표\n\n본문\n`), []);
  const over = checkPlanShape(`${headerOf(4001)}\n## 1. 목표\n\n본문\n`).warnings;
  assert.deepEqual(over, [{ kind: 'header-length', line: 1, value: 4001 }]);
  // `### ` and `#` lines do not end the header; a file without `## ` is all header.
  assert.deepEqual(found(`# Plan\n### 소제목\n${'다'.repeat(4000)}\n## 1. 목표\n`), [
    'header-length@1',
  ]);
  assert.deepEqual(found(headerOf(4001)), ['header-length@1']);
});

test('fence 안의 ## 줄은 header 끝이 아니다', () => {
  const filler = '라'.repeat(4000);
  assert.deepEqual(found(`# Plan\n\`\`\`text\n## 코드 안\n\`\`\`\n${filler}\n## 1. 목표\n`), [
    'header-length@1',
  ]);
  // A tilde fence closes only on a tilde line at least as long; a shorter one stays inside.
  assert.deepEqual(found(`# Plan\n~~~~\n~~~\n## 코드 안\n~~~~\n${filler}\n## 1. 목표\n`), [
    'header-length@1',
  ]);
  // A backtick line whose info string holds a backtick is inline code, not a fence: `## ` after it ends the header.
  assert.deepEqual(found(`# Plan\n\`\`\`a\`b\n## 1. 목표\n${filler}\n`), []);
});

test('Status 줄이 600자이면 경고가 없고 601자이면 status-length다', () => {
  assert.deepEqual(found(`# Plan\n\n- Plan ID: x\n${statusOf(600)}\n\n## 1. 목표\n`), []);
  assert.deepEqual(
    checkPlanShape(`# Plan\n\n- Plan ID: x\n${statusOf(601)}\n\n## 1. 목표\n`).warnings,
    [{ kind: 'status-length', line: 4, value: 601 }],
  );
  assert.deepEqual(found(`# Plan\n${statusOf(601, '상태')}\n## 1. 목표\n`), ['status-length@2']);
  // Only the first Status line outside fences in the header counts.
  assert.deepEqual(
    found(
      `# Plan\n\`\`\`\n${statusOf(700)}\n\`\`\`\n- Status: done\n${statusOf(700)}\n## 1. 목표\n`,
    ),
    [],
  );
  assert.deepEqual(found(`# Plan\n\n## 1. 목표\n\n${statusOf(700)}\n`), []);
});

test('Status 아래 들여쓴 bullet마다 status-sub-bullet이고 빈 줄·최상위 bullet 뒤는 세지 않는다', () => {
  const plan = [
    '# Plan',
    '',
    '- Plan ID: x',
    '- Status: proposed',
    '  - 하위 하나',
    '    - 더 깊은 하위',
    '  1. 번호 하위',
    '  이어지는 문장',
    '  * 별표 하위',
    '  + 더하기 하위',
    '- Parent: y',
    '  - 세지 않음',
    '',
    '## 1. 목표',
  ].join('\n');
  assert.deepEqual(checkPlanShape(plan).warnings, [
    { kind: 'status-sub-bullet', line: 5, value: '' },
    { kind: 'status-sub-bullet', line: 6, value: '' },
    { kind: 'status-sub-bullet', line: 7, value: '' },
    { kind: 'status-sub-bullet', line: 9, value: '' },
    { kind: 'status-sub-bullet', line: 10, value: '' },
  ]);
  assert.deepEqual(found('# Plan\n- Status: proposed\n  - 셈\n\n  - 세지 않음\n## 1. 목표\n'), [
    'status-sub-bullet@3',
  ]);
  assert.deepEqual(found('# Plan\n- Status: proposed\n  - 셈\n2. 최상위 번호\n  - 세지 않음\n'), [
    'status-sub-bullet@3',
  ]);
});

test('한 칸 들여쓴 최상위 항목이나 # 줄에서 세기를 멈추고 그 뒤 두 칸 bullet은 세지 않는다', () => {
  assert.deepEqual(found('# Plan\n- Status: proposed\n  - 셈\n - 한 칸 최상위\n  - 세지 않음\n'), [
    'status-sub-bullet@3',
  ]);
  assert.deepEqual(found('# Plan\n- Status: proposed\n  - 셈\n 1. 한 칸 번호\n  - 세지 않음\n'), [
    'status-sub-bullet@3',
  ]);
  assert.deepEqual(found('# Plan\n- Status: proposed\n  - 셈\n#메모\n  - 세지 않음\n'), [
    'status-sub-bullet@3',
  ]);
  // Counting ends with the header: bullets after the first `## ` are body text.
  assert.deepEqual(found('# Plan\n- Status: proposed\n## 1. 목표\n  - 본문\n'), []);
});

test('표 행의 날짜 뒤 변경 낱말과 결정 id는 table-date-mark이고 출처 날짜·표 밖 줄·fence 안 표는 아니다', () => {
  const plan = [
    '# Plan',
    '',
    '## 2. 결정',
    '',
    '| id | 결정 | 근거 |',
    '|---|---|---|',
    '| D-1 | 값 (2026-10-28 개정 반영) | 근거 |',
    '| D-2 | 2026-10-16 D-OSS-24 ②로 바꿈 | 근거 |',
    '| D-3 | 값 (2026-10-18 주석: 이유) | 근거 |',
    '| D-4 | 값 | (Owner 2026-10-07 보정) |',
    '  | D-5 | 2026-10-20 추가, 2026-10-21 정정 | 들여쓴 표 |',
    '',
    '- 목록 줄의 2026-10-28 개정',
    '',
    '```text',
    '| D-6 | 2026-10-28 개정 |',
    '```',
  ].join('\n');
  assert.deepEqual(checkPlanShape(plan).warnings, [
    { kind: 'table-date-mark', line: 7, value: '2026-10-28 개정' },
    { kind: 'table-date-mark', line: 8, value: '2026-10-16 D-OSS-2' },
    { kind: 'table-date-mark', line: 9, value: '2026-10-18 주석' },
    { kind: 'table-date-mark', line: 11, value: '2026-10-20 추가' },
  ]);
  for (const word of ['변경', '보충', '정정', '갱신']) {
    assert.deepEqual(found(`# Plan\n| a | 2026-01-02 ${word} |\n`), ['table-date-mark@2'], word);
  }
  assert.deepEqual(found('# Plan\n| a | 2026-01-02 D-KPS9 |\n'), ['table-date-mark@2']);
  assert.deepEqual(found('# Plan\n| a | 2026-01-02 D-kps-9 |\n| b | 2026-01-02개정 |\n'), []);
});

test('CLI는 경고가 있어도 exit 0이고 입력 오류는 exit 2다', () => {
  const root = scratch();
  writeFileSync(
    resolve(root, 'big.md'),
    `${headerOf(4001)}\n## 1. 목표\n| a | 2026-10-28 개정 |\n`,
  );
  writeFileSync(resolve(root, 'clean.md'), '# Plan\n- Status: proposed\n## 1. 목표\n');
  const ok = capture(['big.md', 'clean.md'], root);
  assert.equal(ok.code, 0);
  assert.deepEqual(ok.out, [
    'big.md:1\theader-length\t4001',
    'big.md:4\ttable-date-mark\t2026-10-28 개정',
    'files 2 warnings 2',
  ]);
  mkdirSync(resolve(root, 'folder.md'));
  writeFileSync(resolve(root, 'empty.md'), '');
  writeFileSync(resolve(root, 'notes.txt'), '# Plan\n');
  for (const [argv, reason] of [
    [[], /^usage: /u],
    [['--json'], /^usage: /u],
    [['missing.md'], /^no such file: missing\.md$/u],
    [['folder.md'], /^not a file: folder\.md$/u],
    [['empty.md'], /^empty file: empty\.md$/u],
    [['notes.txt'], /^not a Markdown file: notes\.txt$/u],
    [['--bogus', 'clean.md'], /^unknown option: --bogus$/u],
    [['clean.md', 'missing.md'], /^no such file: missing\.md$/u],
  ]) {
    const result = capture(argv, root);
    assert.equal(result.code, 2, JSON.stringify(argv));
    assert.deepEqual(result.out, [], JSON.stringify(argv));
    assert.equal(result.err.length, 1, JSON.stringify(argv));
    assert.match(result.err[0], reason, JSON.stringify(argv));
  }
  const cli = (argv) =>
    spawnSync(process.execPath, [modulePath, ...argv], { cwd: root, encoding: 'utf8' });
  const passed = cli(['big.md']);
  assert.equal(passed.status, 0);
  assert.match(passed.stdout, /^files 1 warnings 2$/mu);
  assert.equal(cli(['missing.md']).status, 2);
});

test('--json은 summary와 warnings를 낸다', () => {
  const root = scratch();
  writeFileSync(resolve(root, 'a.md'), '# Plan\n- Status: proposed\n  - 하위\n## 1.\n');
  writeFileSync(resolve(root, 'b.md'), '# Plan\n');
  const { code, out } = capture(['--json', 'a.md', 'b.md'], root);
  assert.equal(code, 0);
  assert.equal(out.length, 1);
  assert.deepEqual(JSON.parse(out[0]), {
    files: [
      { file: 'a.md', warnings: [{ kind: 'status-sub-bullet', line: 3, value: '' }] },
      { file: 'b.md', warnings: [] },
    ],
    summary: { files: 2, warnings: 1 },
  });
});

test('경고 module은 인자 파일만 읽고 git·network·작업 공간 root literal 없이 node 내장과 block module만 import한다', () => {
  const source = readFileSync(modulePath, 'utf8');
  const imports = [...source.matchAll(/^import [^;]*? from '([^']+)';$/gmu)].map((m) => m[1]);
  assert.ok(imports.length > 0);
  for (const name of imports) {
    assert.ok(name.startsWith('node:') || name === './plan-impact-blocks.mjs', name);
  }
  assert.ok(!imports.includes('node:child_process'));
  assert.doesNotMatch(source, /\.plans\b/u);
  assert.doesNotMatch(source, /\bfetch\s*\(|node:https?|node:net\b/u);
});

// Revision grades. Each case name below is a row of the plan revision grade rules: a path the classifier takes, or one
// condition of that path broken so the line leaves it. The base plan carries every section the cases edit.
const BASE_LINES = [
  '# 계획 예시',
  '',
  '- Plan ID: example',
  '- Status: proposed — 2026-11-01 작성. 다음: 첫 PR',
  '- Parent: [상위](../parent-plan.md)',
  '- 선행: [앞 계획](a-plan.md)',
  '- Owner: lead',
  '',
  '## 1. 배경',
  '',
  '- 기존 bullet 하나',
  '- 기존 bullet 둘',
  '',
  '```text',
  '## 9. 결정',
  '```',
  '',
  '## 2. 결정',
  '',
  '| id | 결정 | 근거·기각 |',
  '|---|---|---|',
  '| D-1 | 값 하나 | 근거 하나 |',
  '',
  '## 3. 계획 graph',
  '',
  '| 단위 | 목표 | 상태 |',
  '|---|---|---|',
  '| A | 목표 \\| 하나 | draft |',
  '| B | 목표 둘 | draft |',
  '',
  '### 3.1 시각 탐색 회차',
  '',
  '- 1회차: 비교 이미지',
  '',
  '#### 3.1.1 비교 메모',
  '',
  '- 메모 하나',
  '',
  '## 4. Phase',
  '',
  '- 첫 단계',
  '',
  '### 4.1 메모',
  '',
  '- 메모 둘',
  '',
  '## 5. Acceptance',
  '',
  '- [x] 준비 — 2026-11-02',
  '- [ ] 절차 PR merge',
  '1. [ ] 번호 항목',
  '',
  '## 6. 메모',
  '',
  '본문 [링크](a.md#x) 문장.',
  '근거 문장은 분석 3.4절이다.',
  '체크 아닌 줄 [ ] 표시',
  '',
  '## 개정 이력',
  '',
  '- 2026-11-02 — 둘째 개정',
  '- 2026-11-01 — 작성',
  '',
];
const BASE = BASE_LINES.join('\n');

function at(lines, text) {
  const index = lines.indexOf(text);
  assert.ok(index >= 0, `fixture line: ${text}`);
  return index;
}
function revised(change, lines = BASE_LINES) {
  const copy = [...lines];
  change(copy);
  return copy.join('\n');
}
const replaceLine = (lines, from, to) => {
  lines[at(lines, from)] = to;
};
const insertAfter = (lines, anchor, ...added) => lines.splice(at(lines, anchor) + 1, 0, ...added);
const removeLine = (lines, text) => lines.splice(at(lines, text), 1);
const minimum = (before, after) => shape.classifyRevision(before, after).minimum;
const gradeOf = (change) => minimum(BASE, revised(change));

test('Status 줄만 고침 → P0', () => {
  const after = revised((l) =>
    replaceLine(l, BASE_LINES[3], '- Status: active — 2026-11-03 PR #900 merge. 다음: 둘째 PR'),
  );
  assert.equal(minimum(BASE, after), 'P0');
  assert.deepEqual(shape.classifyRevision(BASE, after).lines, [
    { side: 'after', line: 4, grade: 'P0', kind: 'status-line', heading: '# 계획 예시' },
  ]);
});

test('header의 다른 줄(`Status`·`Parent`·`선행`·`선후행` 밖) 고침 → P2', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '- Owner: lead', '- Owner: lead와 reviewer')),
    'P2',
  );
});

test('개정 이력 줄 추가 → P0', () => {
  assert.equal(
    gradeOf((l) => insertAfter(l, '## 개정 이력', '', '- 2026-11-03 — 상태 정정')),
    'P0',
  );
});

test('개정 이력 줄 삭제·같은 절 안 이동 → P0', () => {
  assert.equal(
    gradeOf((l) => removeLine(l, '- 2026-11-01 — 작성')),
    'P0',
  );
  const moved = revised((l) => {
    removeLine(l, '- 2026-11-01 — 작성');
    insertAfter(l, '## 개정 이력', '', '- 2026-11-01 — 작성');
  });
  assert.equal(minimum(BASE, moved), 'P0');
});

test('`### 개정 이력 규칙` 같은 다른 heading 아래 줄 고침 → P2', () => {
  const lines = [
    '# 계획 예시',
    '- Status: proposed',
    '## 1. 메모',
    '### 개정 이력 규칙',
    '- 규칙 줄',
    '## 개정 이력',
    '- 2026-11-01 — 작성',
  ];
  assert.equal(
    minimum(
      lines.join('\n'),
      revised((l) => replaceLine(l, '- 규칙 줄', '- 고친 규칙 줄'), lines),
    ),
    'P2',
  );
});

test('표 `상태` 열 칸만 바뀐 행 → P0', () => {
  assert.equal(
    gradeOf((l) =>
      replaceLine(l, '| B | 목표 둘 | draft |', '| B | 목표 둘 | proposed(2026-11-03) |'),
    ),
    'P0',
  );
});

test('`상태` 칸과 같은 행의 다른 칸이 함께 바뀐 행 → P2', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '| B | 목표 둘 | draft |', '| B | 목표 셋 | proposed |')),
    'P2',
  );
});

test('머리가 `상태`가 아닌 열(`목표`) 칸만 바뀐 행 → P2', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '| B | 목표 둘 | draft |', '| B | 목표 셋 | draft |')),
    'P2',
  );
});

test('표 머리 행이나 정렬 줄이 바뀐 줄 → P2', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '| 단위 | 목표 | 상태 |', '| 단계 | 목표 | 상태 |')),
    'P2',
  );
  // Only the alignment cell under `상태` changes, so a classifier that reads it as a body row would call it P0.
  assert.equal(
    gradeOf((l) => {
      l[at(l, '| 단위 | 목표 | 상태 |') + 1] = '|---|---|:---:|';
    }),
    'P2',
  );
});

test('앞 칸에 `\\|`가 든 행의 `상태` 칸만 바뀜 → P0', () => {
  assert.equal(
    gradeOf((l) =>
      replaceLine(l, '| A | 목표 \\| 하나 | draft |', '| A | 목표 \\| 하나 | proposed |'),
    ),
    'P0',
  );
});

test('link target만 바뀐 줄 → P0', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '본문 [링크](a.md#x) 문장.', '본문 [링크](b.md#y) 문장.')),
    'P0',
  );
});

test('link target과 link text가 함께 바뀐 줄 → P2', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '본문 [링크](a.md#x) 문장.', '본문 [고친 링크](b.md#y) 문장.')),
    'P2',
  );
});

test('link target과 줄의 다른 글자가 함께 바뀐 줄 → P2', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '본문 [링크](a.md#x) 문장.', '본문 [링크](b.md#y) 고친 문장.')),
    'P2',
  );
});

test('목록 항목 `[ ]`→`[x]`와 줄 끝 추가 → P0(번호 목록 포함)', () => {
  assert.equal(
    gradeOf((l) =>
      replaceLine(l, '- [ ] 절차 PR merge', '- [x] 절차 PR merge — 2026-11-03, #900, `pr/review/`'),
    ),
    'P0',
  );
  assert.equal(
    gradeOf((l) => replaceLine(l, '1. [ ] 번호 항목', '1. [x] 번호 항목 — 2026-11-03')),
    'P0',
  );
  assert.equal(
    gradeOf((l) => {
      replaceLine(l, '- [ ] 절차 PR merge', '- [x] 절차 PR merge');
      replaceLine(l, '1. [ ] 번호 항목', '1. [x] 번호 항목 — 2026-11-03');
    }),
    'P0',
  );
  for (const marker of ['*', '+', '2)']) {
    const lines = ['# 계획 예시', '## 1. Acceptance', `${marker} [ ] 항목`];
    const after = revised(
      (l) => replaceLine(l, `${marker} [ ] 항목`, `${marker} [x] 항목 — #900`),
      lines,
    );
    assert.equal(minimum(lines.join('\n'), after), 'P0', marker);
  }
});

test('체크하며 그 줄의 기존 글자를 고침 → P2', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '- [ ] 절차 PR merge', '- [x] 절차 PR 병합 — 2026-11-03')),
    'P2',
  );
});

test('`[x]`→`[ ]` 되돌림 → P2', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '- [x] 준비 — 2026-11-02', '- [ ] 준비 — 2026-11-02')),
    'P2',
  );
});

test('목록 항목이 아닌 줄의 `[ ]`→`[x]` → P2', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '체크 아닌 줄 [ ] 표시', '체크 아닌 줄 [x] 표시')),
    'P2',
  );
});

test('`탐색 회차` heading 아래 추가 → P0', () => {
  assert.equal(
    gradeOf((l) => insertAfter(l, '- 1회차: 비교 이미지', '- 2회차: 비교 이미지와 Owner 원문')),
    'P0',
  );
});

test('`탐색 회차` 절 기존 줄 고침 → P2', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '- 1회차: 비교 이미지', '- 1회차: 고친 비교 이미지')),
    'P2',
  );
});

test('`탐색 회차` 절 줄 삭제 → P2', () => {
  assert.equal(
    gradeOf((l) => removeLine(l, '- 1회차: 비교 이미지')),
    'P2',
  );
});

test('상위 heading에만 `탐색 회차`가 있는 하위 절의 추가 → P1', () => {
  assert.equal(
    gradeOf((l) => insertAfter(l, '- 메모 하나', '- 메모 셋')),
    'P1',
  );
});

test('`결정` heading 아래 표의 `근거·기각` 열 칸만 바뀐 행 → P1', () => {
  assert.equal(
    gradeOf((l) =>
      replaceLine(
        l,
        '| D-1 | 값 하나 | 근거 하나 |',
        '| D-1 | 값 하나 | 근거 하나, [분석](r.md) |',
      ),
    ),
    'P1',
  );
});

test('`근거` 칸과 `결정` 칸이 함께 바뀐 행 → P2', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '| D-1 | 값 하나 | 근거 하나 |', '| D-1 | 값 둘 | 근거 둘 |')),
    'P2',
  );
});

test('같은 표의 `결정` 열 칸만 고침 → P2', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '| D-1 | 값 하나 | 근거 하나 |', '| D-1 | 값 둘 | 근거 하나 |')),
    'P2',
  );
});

test('기존 줄에 링크만 끼움 → P1', () => {
  // A link put in mid-line, or at the end or the start with the one space that separates it, comes out with that space.
  for (const next of [
    '근거 문장은 분석 3.4절[링크](r.md)이다.',
    '근거 문장은 분석[원천](r.md) 3.4절이다.',
    '근거 문장은 분석 3.4절이다. [원천](r.md)',
    '[원천](r.md) 근거 문장은 분석 3.4절이다.',
    '근거 문장은 분석 3.4절이다. [원천](r.md) [둘째](s.md)',
  ])
    assert.equal(
      gradeOf((l) => replaceLine(l, '근거 문장은 분석 3.4절이다.', next)),
      'P1',
      next,
    );
  assert.equal(
    gradeOf((l) =>
      replaceLine(l, '본문 [링크](a.md#x) 문장.', '본문 [링크](a.md#x) 문장. [원천](r.md)'),
    ),
    'P1',
  );
});

test('링크를 끼우며 공백 하나가 늘어남 → P1', () => {
  assert.equal(
    gradeOf((l) =>
      replaceLine(
        l,
        '근거 문장은 분석 3.4절이다.',
        '근거 문장은 분석 [3.4절 원천](r.md)  3.4절이다.',
      ),
    ),
    'P1',
  );
});

test('링크와 다른 글자를 함께 끼움 → P2', () => {
  assert.equal(
    gradeOf((l) =>
      replaceLine(
        l,
        '근거 문장은 분석 3.4절이다.',
        '근거 문장은 분석 [링크](r.md) 새 글자 3.4절이다.',
      ),
    ),
    'P2',
  );
  // Indenting the line while appending a link is not a link-only change.
  assert.equal(
    gradeOf((l) =>
      replaceLine(l, '근거 문장은 분석 3.4절이다.', '  근거 문장은 분석 3.4절이다. [원천](r.md)'),
    ),
    'P2',
  );
});

// The keyword list is written out here, not read from the module, so dropping one keyword there fails this test.
const P2_HEADING_WORDS = [
  'contract',
  'Owned',
  'owned',
  'RED',
  'Acceptance',
  '결정',
  'Phase',
  '순서',
  '선행',
  '멈춤',
  '범위',
  '규칙',
  '목표',
  'Open Questions',
];

test('P2 keyword 14개마다 그 heading 아래 추가 → P2(표 구동, `Owned` 포함)', () => {
  assert.equal(P2_HEADING_WORDS.length, 14);
  for (const word of P2_HEADING_WORDS) {
    const lines = [
      '# 계획 예시',
      '- Status: proposed',
      '',
      `## 7. ${word} 절`,
      '',
      '- 기존 bullet',
    ];
    const after = revised((l) => insertAfter(l, '- 기존 bullet', '- 새 bullet'), lines);
    assert.equal(minimum(lines.join('\n'), after), 'P2', word);
  }
});

test('P2 heading 밖 bullet 추가 → P1', () => {
  assert.equal(
    gradeOf((l) => insertAfter(l, '- 기존 bullet 둘', '- 기존 bullet 셋')),
    'P1',
  );
});

test('같은 곳 기존 bullet 고침 → P2', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '- 기존 bullet 둘', '- 고친 bullet 둘')),
    'P2',
  );
});

test('상위 heading만 P2 keyword를 가진 하위 절의 추가 → P1', () => {
  assert.equal(
    gradeOf((l) => insertAfter(l, '- 메모 둘', '- 메모 넷')),
    'P1',
  );
});

test('같은 곳 기존 bullet 한 줄만 삭제 → P2', () => {
  assert.equal(
    gradeOf((l) => removeLine(l, '- 기존 bullet 둘')),
    'P2',
  );
});

test('개정 이력 바로 앞 절의 끝 줄 삭제 → P2', () => {
  assert.equal(
    gradeOf((l) => removeLine(l, '체크 아닌 줄 [ ] 표시')),
    'P2',
  );
});

test('빈 줄 없이 `## 개정 이력` 바로 위에 있던 줄을 지움 → P2', () => {
  const lines = [
    '# 계획 예시',
    '- Status: proposed',
    '',
    '## 1. 메모',
    '',
    '- 마지막 줄',
    '## 개정 이력',
    '',
    '- 2026-11-01 — 작성',
  ];
  assert.equal(
    minimum(
      lines.join('\n'),
      revised((l) => removeLine(l, '- 마지막 줄'), lines),
    ),
    'P2',
  );
});

const HEADER_LINES = [
  '# 계획 예시',
  '',
  '- Plan ID: example',
  '- Status: proposed',
  '- Owner: lead',
  '',
  '## 1. 배경',
  '',
  '- 본문',
];

test('header `Parent`·`선행`·`선후행` 줄마다 추가 → P2', () => {
  for (const line of ['- Parent: [상위](p.md)', '- 선행: [앞 계획](a.md)', '- 선후행: 없음']) {
    const after = revised((l) => insertAfter(l, '- Status: proposed', line), HEADER_LINES);
    assert.equal(minimum(HEADER_LINES.join('\n'), after), 'P2', line);
  }
});

test('header의 다른 줄 추가 → P1(제목에 P2 keyword 없음)', () => {
  const after = revised(
    (l) => insertAfter(l, '- Status: proposed', '- Evidence: not-applicable'),
    HEADER_LINES,
  );
  assert.equal(minimum(HEADER_LINES.join('\n'), after), 'P1');
});

test('새 문서 `-` → P1', () => {
  // The new document has `결정`·`Phase`·`Acceptance` headings, which would be P2 if it were read as added lines.
  assert.equal(minimum(null, BASE), 'P1');
  assert.deepEqual(shape.classifyRevision(null, BASE).lines, [
    { side: 'after', line: 1, grade: 'P1', kind: 'new-document', heading: '# 계획 예시' },
  ]);
});

test('P0 줄과 P2 줄이 섞인 개정 → P2', () => {
  const after = revised((l) => {
    replaceLine(l, BASE_LINES[3], '- Status: active — 2026-11-03. 다음: 둘째 PR');
    replaceLine(l, '- 기존 bullet 둘', '- 고친 bullet 둘');
  });
  const result = shape.classifyRevision(BASE, after);
  assert.equal(result.minimum, 'P2');
  assert.deepEqual(
    result.lines.map(({ line, grade }) => `${line}:${grade}`),
    ['4:P0', '12:P2'],
  );
});

function revisionFiles(change, lines = BASE_LINES) {
  const root = scratch();
  writeFileSync(resolve(root, 'before.md'), lines.join('\n'));
  writeFileSync(resolve(root, 'after.md'), revised(change, lines));
  return root;
}
const modifyBullet = (l) => replaceLine(l, '- 기존 bullet 둘', '- 고친 bullet 둘');
const addBullet = (l) => insertAfter(l, '- 기존 bullet 둘', '- 기존 bullet 셋');

test('선언 P1·최소 P2 → exit 1 `grade-below-minimum`', () => {
  const root = revisionFiles(modifyBullet);
  const result = capture(['--revision', 'before.md', 'after.md', '--declared', 'P1'], root);
  assert.equal(result.code, 1, result.err.join('\n'));
  assert.equal(result.out.at(-1), 'declared P1 minimum P2 grade-below-minimum');
});

test('선언과 최소가 같으면 exit 0', () => {
  const p2 = capture(
    ['--revision', 'before.md', 'after.md', '--declared', 'P2'],
    revisionFiles(modifyBullet),
  );
  assert.equal(p2.code, 0, p2.err.join('\n'));
  assert.equal(p2.out.at(-1), 'declared P2 minimum P2 ok');
  const p1 = capture(
    ['--revision', 'before.md', 'after.md', '--declared', 'P1'],
    revisionFiles(addBullet),
  );
  assert.equal(p1.code, 0, p1.err.join('\n'));
  assert.equal(p1.out.at(-1), 'declared P1 minimum P1 ok');
});

test('선언 P3·최소 P1 → exit 0', () => {
  const result = capture(
    ['--revision', 'before.md', 'after.md', '--declared', 'P3'],
    revisionFiles(addBullet),
  );
  assert.equal(result.code, 0, result.err.join('\n'));
  assert.equal(result.out.at(-1), 'declared P3 minimum P1 ok');
});

test('어떤 경우도 최소 P3를 내지 않음', () => {
  const rewritten = BASE_LINES.map((line) => (line ? `${line} 고침` : line)).join('\n');
  const cases = [
    [BASE, rewritten],
    [BASE, '# 다른 계획\n'],
    ['# 다른 계획\n', BASE],
    [null, BASE],
    [BASE, BASE],
  ];
  for (const [before, after] of cases) {
    const result = shape.classifyRevision(before, after);
    assert.ok(['P0', 'P1', 'P2'].includes(result.minimum), result.minimum);
    assert.ok(result.lines.every(({ grade }) => grade !== 'P3'));
  }
});

test('P2 경우의 출력에 그 등급을 만든 줄 번호·heading이 있음', () => {
  const result = capture(
    ['--revision', 'before.md', 'after.md', '--declared', 'P2'],
    revisionFiles(modifyBullet),
  );
  assert.equal(result.code, 0, result.err.join('\n'));
  assert.deepEqual(result.out, [
    'after.md: minimum P2 (before before.md, changed lines 1)',
    `after.md:${at(BASE_LINES, '- 기존 bullet 둘') + 1}\tP2\tmodified\t## 1. 배경`,
    'declared P2 minimum P2 ok',
  ]);
});

test('fence 안 `##`는 heading이 아님', () => {
  // The added line follows a fence that holds `## 9. 결정`; its nearest heading is `## 1. 배경`.
  assert.equal(
    gradeOf((l) => insertAfter(l, '```', '- fence 뒤 bullet')),
    'P1',
  );
});

test('source에 git·child process가 없음', () => {
  const source = readFileSync(modulePath, 'utf8');
  assert.doesNotMatch(source, /\bgit\b/u);
  assert.doesNotMatch(source, /child_process|\bspawn|\bexec(?:File)?Sync\b/u);
});

// Fixtures the grade rules leave to the implementation: hunks of unequal length and tables whose cell count changes.
test('길이가 다른 고침 hunk는 앞에서부터 짝짓고 남는 줄은 고친 줄로 본다', () => {
  // Status changes and a header line is added right under it: one hunk, the Status pair is P0, the extra line P2.
  const added = revised((l) => {
    replaceLine(l, BASE_LINES[3], '- Status: active — 2026-11-03. 다음: 둘째 PR');
    insertAfter(l, '- Status: active — 2026-11-03. 다음: 둘째 PR', '- Evidence: not-applicable');
  });
  assert.deepEqual(
    shape
      .classifyRevision(BASE, added)
      .lines.map(({ line, grade, kind }) => `${line}:${grade}:${kind}`),
    ['4:P0:status-line', '5:P2:modified'],
  );
  // The other way round: the line under Status is removed in the same hunk.
  const removed = revised((l) => {
    replaceLine(l, BASE_LINES[3], '- Status: active — 2026-11-03. 다음: 둘째 PR');
    removeLine(l, '- Parent: [상위](../parent-plan.md)');
  });
  assert.deepEqual(
    shape
      .classifyRevision(BASE, removed)
      .lines.map(({ side, line, grade, kind }) => `${side}:${line}:${grade}:${kind}`),
    ['after:4:P0:status-line', 'before:5:P2:deleted'],
  );
  // In `## 개정 이력` every line stays P0 however the hunk pairs.
  const history = revised((l) => {
    replaceLine(l, '- 2026-11-02 — 둘째 개정', '- 2026-11-02 — 둘째 개정(고침)');
    insertAfter(l, '- 2026-11-02 — 둘째 개정(고침)', '- 2026-11-02 — 같은 날 정정');
  });
  assert.equal(minimum(BASE, history), 'P0');
});

test('표 칸 수가 바뀐 행은 P2다', () => {
  assert.equal(
    gradeOf((l) => replaceLine(l, '| B | 목표 둘 | draft |', '| B | 목표 둘 | proposed | 메모 |')),
    'P2',
  );
  assert.equal(
    gradeOf((l) =>
      replaceLine(l, '| D-1 | 값 하나 | 근거 하나 |', '| D-1 | 값 하나 | 근거 둘 | 메모 |'),
    ),
    'P2',
  );
});

test('fence를 열거나 닫아 그대로인 줄의 heading 여부가 바뀌면 그 줄이 P2다', () => {
  // An unclosed fence added in the exploration-round section turns every later heading into code: the bullet added under
  // `## 6. 메모` would read as part of the exploration section, so the unchanged heading lines carry the grade.
  const after = revised((l) => {
    insertAfter(l, '- 1회차: 비교 이미지', '```');
    insertAfter(l, '근거 문장은 분석 3.4절이다.', '- 새 결정 메모');
  });
  const { minimum: grade, lines } = shape.classifyRevision(BASE, after);
  assert.equal(grade, 'P2');
  assert.ok(
    lines.some(
      ({ side, line, kind }) =>
        side === 'after' &&
        kind === 'heading-structure' &&
        line === at(after.split('\n'), '## 4. Phase') + 1,
    ),
  );
  // A closed fence that holds a `##` line is code added inside the section; no unchanged heading changes.
  assert.equal(
    gradeOf((l) => insertAfter(l, '- 1회차: 비교 이미지', '```text', '## 7. 범위', '```')),
    'P0',
  );
});

test('heading에 `탐색 회차`와 P2 keyword가 함께 들면 그 절의 추가는 P2다', () => {
  // Each rule gives a floor; the line takes the higher one.
  assert.equal(
    gradeOf((l) =>
      insertAfter(l, '체크 아닌 줄 [ ] 표시', '', '### 6.1 탐색 회차 결정', '', '- 방향 확정'),
    ),
    'P2',
  );
});

test('바뀐 줄이 없으면 최소 P0이고 줄 목록이 비었다', () => {
  assert.deepEqual(shape.classifyRevision(BASE, BASE), { minimum: 'P0', lines: [] });
});

test('--revision은 문서마다 최소 등급을 내고 --json은 모든 줄을 낸다', () => {
  const root = revisionFiles(modifyBullet);
  writeFileSync(resolve(root, 'new.md'), BASE);
  const result = capture(
    [
      '--json',
      '--revision',
      'before.md',
      'after.md',
      '--revision',
      '-',
      'new.md',
      '--declared',
      'P2',
    ],
    root,
  );
  assert.equal(result.code, 0, result.err.join('\n'));
  assert.equal(result.out.length, 1);
  assert.deepEqual(JSON.parse(result.out[0]), {
    revisions: [
      {
        before: 'before.md',
        after: 'after.md',
        minimum: 'P2',
        lines: [{ side: 'after', line: 12, grade: 'P2', kind: 'modified', heading: '## 1. 배경' }],
      },
      {
        before: '-',
        after: 'new.md',
        minimum: 'P1',
        lines: [
          { side: 'after', line: 1, grade: 'P1', kind: 'new-document', heading: '# 계획 예시' },
        ],
      },
    ],
    declared: 'P2',
    minimum: 'P2',
    result: 'ok',
  });
});

test('--revision 입력 오류는 출력 없이 exit 2다', () => {
  const root = revisionFiles(modifyBullet);
  for (const [argv, reason] of [
    [['--revision', 'before.md', 'after.md'], /^usage: /u],
    [['--declared', 'P1'], /^usage: /u],
    [['--revision', 'before.md', '--declared', 'P1'], /^usage: /u],
    [['--revision', 'before.md', 'after.md', '--declared', 'P4'], /^unknown grade: P4$/u],
    [['--revision', 'before.md', 'after.md', '--declared', 'P1', '--declared', 'P2'], /^usage: /u],
    [['--revision', 'before.md', 'after.md', 'before.md', '--declared', 'P1'], /^usage: /u],
    [['--revision', 'missing.md', 'after.md', '--declared', 'P1'], /^no such file: missing\.md$/u],
    [['--revision', 'before.md', '-', '--declared', 'P1'], /^not a Markdown file: -$/u],
  ]) {
    const result = capture(argv, root);
    assert.equal(result.code, 2, `${JSON.stringify(argv)} ${result.err.join('\n')}`);
    assert.deepEqual(result.out, [], JSON.stringify(argv));
    assert.equal(result.err.length, 1, JSON.stringify(argv));
    assert.match(result.err[0], reason, JSON.stringify(argv));
  }
});
