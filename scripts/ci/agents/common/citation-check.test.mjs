import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import { main } from '../../../agents/common/citation-check.mjs';

const tool = resolve(import.meta.dirname, '../../../agents/common/citation-check.mjs');
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

// src/tool.mjs has five lines and a final newline, so citations may use line 6 (the plan-impact line count).
const TRACKED = {
  'src/tool.mjs':
    "// tool\nexport function value() {\n  return 1;\n}\nexport const name = 'tool';\n",
  'src/a/dup.mjs': 'export const a = 1;\n',
  'src/b/dup.mjs': 'export const b = 1;\n',
  'scripts/agents/native-session.mjs': '// session\n',
  'assets/blob.bin': 'binary\0content\n',
};

const DEFECTS = [
  '# Defects',
  '',
  '- unresolved `src/missing.mjs:2`',
  '- file name typo without a path `native-sesion.mjs:12`',
  '- ambiguous suffix `dup.mjs:1`',
  '- past the last line `src/tool.mjs:7`',
  '- range end past the last line `src/tool.mjs:2-9`',
  '- reversed range `src/tool.mjs:4-2`',
  '- line zero `src/tool.mjs:0`',
  '- content mismatch `src/tool.mjs:3` ~ "return 3"',
  '- empty expectation `src/tool.mjs:3` ~ ""',
  '- unterminated expectation `src/tool.mjs:3` ~ "return',
  '- binary target `assets/blob.bin:1`',
  '- path differing only in case `SRC/tool.mjs:1`',
  '',
].join('\n');

const CLEAN = [
  '# Clean',
  '',
  '- exact `src/tool.mjs:2`, range to the line after the final newline `src/tool.mjs:1-6`',
  '- unique suffixes `tool.mjs:3` and `a/dup.mjs:1`',
  '- content `src/tool.mjs:2-4` ~ "return 1"',
  '- untracked file on disk `drafts/note.md:1`',
  '- untracked extension in another case is not a citation `drafts/data.cfg:1`',
  '- not citations `localhost:3000`, `example.com:443`, `127.0.0.1:5432`',
  '- bare citation src/tool.mjs:99 outside backticks is only counted',
  '- spans of another shape are only counted `src/tool.mjs:99:1`, `see src/tool.mjs:99`',
  '',
  '```text',
  '`src/missing.mjs:1` inside a fence is not checked',
  '```',
  '',
  '~~~',
  '`dup.mjs:1`',
  '~~~',
  '',
  '- a list item with an indented fence',
  '',
  '      ```js',
  '      `src/tool.mjs:99`',
  '      ```',
  '',
].join('\n');

function writeTree(root, files) {
  for (const [path, text] of Object.entries(files)) {
    const target = resolve(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
}

function fixture(extra = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'citation-check-'));
  temporary.push(root);
  writeTree(root, TRACKED);
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  writeTree(root, {
    'drafts/note.md': '# Note\n',
    'drafts/Data.cfg': 'key = value\n',
    'notes/defects.md': DEFECTS,
    'notes/clean.md': CLEAN,
    ...extra,
  });
  return root;
}

function run(argv, cwd) {
  const out = [];
  const err = [];
  const code = main(argv, { cwd, log: (line) => out.push(line), error: (line) => err.push(line) });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

function json(text) {
  assert.match(text, /^\{/u, 'JSON output');
  return JSON.parse(text);
}

test('defective citations are violations with their kind and line', () => {
  const root = fixture();
  const { code, out } = run(['--json', 'notes/defects.md'], root);
  assert.equal(code, 1);
  const result = json(out);
  assert.deepEqual(
    result.violations.map(({ file, line, citation, kind }) => [file, line, citation, kind]),
    [
      ['notes/defects.md', 3, 'src/missing.mjs:2', 'unresolved'],
      ['notes/defects.md', 4, 'native-sesion.mjs:12', 'unresolved'],
      ['notes/defects.md', 5, 'dup.mjs:1', 'ambiguous'],
      ['notes/defects.md', 6, 'src/tool.mjs:7', 'out-of-range'],
      ['notes/defects.md', 7, 'src/tool.mjs:2-9', 'out-of-range'],
      ['notes/defects.md', 8, 'src/tool.mjs:4-2', 'invalid-range'],
      ['notes/defects.md', 9, 'src/tool.mjs:0', 'invalid-range'],
      ['notes/defects.md', 10, 'src/tool.mjs:3', 'content-mismatch'],
      ['notes/defects.md', 11, 'src/tool.mjs:3', 'invalid-expectation'],
      ['notes/defects.md', 12, 'src/tool.mjs:3', 'invalid-expectation'],
      ['notes/defects.md', 13, 'assets/blob.bin:1', 'unreadable'],
      ['notes/defects.md', 14, 'SRC/tool.mjs:1', 'unresolved'],
    ],
  );
  assert.equal(result.summary.citations, 12);
  assert.equal(result.summary.violations, 12);
});

test('resolved citations, fenced code and non-citations pass and are counted', () => {
  const root = fixture();
  const { code, out } = run(['--json', 'notes/clean.md'], root);
  assert.equal(code, 0);
  assert.deepEqual(json(out).summary, {
    files: 1,
    citations: 6,
    exact: 4,
    suffix: 2,
    contentChecks: 1,
    violations: 0,
    notCitations: 4,
    unchecked: 3,
  });
});

test('CRLF documents give the same result', () => {
  const root = fixture({
    'notes/clean-crlf.md': CLEAN.replaceAll('\n', '\r\n'),
    'notes/defects-crlf.md': DEFECTS.replaceAll('\n', '\r\n'),
  });
  const clean = run(['--json', 'notes/clean-crlf.md'], root);
  assert.equal(clean.code, 0);
  assert.equal(json(clean.out).summary.citations, 6);
  const defects = run(['--json', 'notes/defects-crlf.md'], root);
  assert.equal(defects.code, 1);
  assert.equal(json(defects.out).summary.violations, 12);
});

test('several documents are checked together and the table output names each violation', () => {
  const root = fixture();
  const { code, out } = run(['notes/clean.md', 'notes/defects.md'], root);
  assert.equal(code, 1);
  assert.match(out, /notes\/defects\.md:3\tunresolved\tsrc\/missing\.mjs:2/u);
  assert.match(out, /citations 18 .*violations 12/u);
  assert.doesNotMatch(out, /notes\/clean\.md:\d+\t/u);
});

test('the root option resolves citations from another directory', () => {
  const root = fixture();
  const elsewhere = mkdtempSync(resolve(tmpdir(), 'citation-check-cwd-'));
  temporary.push(elsewhere);
  const { code, out } = run(['--json', '--root', root, resolve(root, 'notes/clean.md')], elsewhere);
  assert.equal(code, 0);
  assert.equal(json(out).summary.citations, 6);
});

test('input errors exit 2 instead of passing', () => {
  const root = fixture({ 'notes/empty.md': '', 'notes/data.json': '{}\n' });
  const outside = mkdtempSync(resolve(tmpdir(), 'citation-check-nogit-'));
  temporary.push(outside);
  writeTree(outside, { 'doc.md': '`a.md:1`\n' });
  for (const [argv, cwd] of [
    [[], root],
    [['notes/absent.md'], root],
    [['--bogus', 'notes/clean.md'], root],
    [['notes/empty.md'], root],
    [['notes/data.json'], root],
    [['doc.md'], outside],
  ]) {
    const { code, err } = run(argv, cwd);
    assert.equal(code, 2, argv.join(' '));
    assert.ok(err.length > 0, argv.join(' '));
  }
});

test('the command line exits 1 on violations and 0 on a clean document', () => {
  const root = fixture();
  const defects = spawnSync(process.execPath, [tool, 'notes/defects.md'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(defects.status, 1, defects.stderr);
  const clean = spawnSync(process.execPath, [tool, 'notes/clean.md'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(clean.status, 0, clean.stderr);
  const missing = spawnSync(process.execPath, [tool], { cwd: root, encoding: 'utf8' });
  assert.equal(missing.status, 2);
});
