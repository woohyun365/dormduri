import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { checkPlanShape, main } from '../../../agents/common/plan-shape-check.mjs';

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
