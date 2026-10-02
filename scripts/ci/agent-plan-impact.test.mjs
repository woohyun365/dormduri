import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import { blockMap } from '../agents/common/plan-impact-blocks.mjs';
import {
  expandLines,
  globMatch,
  main,
  runImpact,
  unicodeRegExp,
} from '../agents/common/plan-impact.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const temporary = [];
test.after(() => temporary.forEach((path) => rmSync(path, { recursive: true, force: true })));

const BASE_FILES = {
  'docs/guide.md': '# Guide\n\nUse the Sol model here.\n\n## Details\n\nNothing else.\n',
  'scripts/tool.mjs':
    "// Tool\nimport { x } from './lib.mjs';\n\nexport function run() {\n  return 'Sol' + x;\n}\n\n// trailing note\n",
  'scripts/lib.mjs': 'export const x = 1;\n',
  'other/product.mjs': "export const label = 'Sol';\n",
};

const BASE_SPEC = {
  'impact.json': JSON.stringify({
    classes: ['A', 'B', 'NONE'],
    passiveClasses: ['NONE'],
    blockClasses: ['A', 'B'],
    universe: ['docs/**', 'scripts/**'],
    blockFiles: { extensions: ['mjs', 'md'], names: [] },
    importTargets: ['scripts/lib.mjs'],
    linkTargets: [],
  }),
  'patterns.tsv': 'model\t\\bSol\\b\n',
  'file-rules.tsv': '# glob\tclass\treason\nother/**\tNONE\tproduct wording\n',
  'rows/L1.tsv':
    'docs/guide.md:3\tA\tguide names the model\nscripts/tool.mjs:2\tB\timport of the target module\nscripts/tool.mjs:5\tA\treturn value\n',
  'contract-targets.tsv': 'docs/guide.md#Details\tB\tblocks\tdetails section\n',
  'consumers.tsv': '',
  'regression.tsv': '# Lane review\nscripts/tool.mjs\t5\tA\tcited line\n',
};

function writeTree(root, files, { crlf = false } = {}) {
  for (const [path, text] of Object.entries(files)) {
    const target = resolve(root, path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, crlf ? text.replaceAll('\n', '\r\n') : text);
  }
}

function fixture({ files = {}, spec = {}, crlf = false } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'plan-impact-'));
  temporary.push(root);
  const repo = resolve(root, 'repo');
  const specDirectory = resolve(root, 'spec');
  writeTree(repo, { ...BASE_FILES, ...files }, { crlf });
  writeTree(
    specDirectory,
    Object.fromEntries(Object.entries({ ...BASE_SPEC, ...spec }).filter(([, v]) => v !== null)),
    {
      crlf,
    },
  );
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['add', '-A'], { cwd: repo });
  return { repo, specDirectory, root };
}

function problems(options) {
  const { repo, specDirectory } = fixture(options);
  return runImpact({ root: repo, specDirectory }).problems;
}

test('a fully classified fixture passes every line, block and regression check', () => {
  const { repo, specDirectory } = fixture();
  const result = runImpact({ root: repo, specDirectory });
  assert.deepEqual(result.problems, []);
  assert.deepEqual(
    {
      keys: result.summary.scan.keys,
      patterns: result.summary.scan.patterns,
      imports: result.summary.scan.imports,
    },
    { keys: 4, patterns: 3, imports: 1 },
  );
  assert.deepEqual(result.summary.lines.sources, { scan: 4, semantic: 0, parent: 0 });
  assert.deepEqual(result.summary.blocks.perPr, {
    A: { blocks: 2, files: 2 },
    B: { blocks: 2, files: 2 },
  });
  assert.deepEqual(result.summary.regression, {
    covered: 1,
    notCovered: 0,
    sections: [{ title: 'Lane review', lines: 1, coveredByRowsAlone: 1 }],
  });
});

test('a scanned line without a row, rule or override is unclassified', () => {
  assert.deepEqual(
    problems({
      files: {
        'docs/guide.md':
          '# Guide\n\nUse the Sol model here.\n\nSol again.\n\n## Details\n\nNothing else.\n',
      },
    }).filter((p) => p.startsWith('UNCLASSIFIED')),
    ['UNCLASSIFIED docs/guide.md:5'],
  );
});

test('a row for a line the scan no longer finds is stale', () => {
  const rows = `${BASE_SPEC['rows/L1.tsv']}docs/guide.md:7\tA\told hit\n`;
  assert.deepEqual(problems({ spec: { 'rows/L1.tsv': rows } }), ['STALE docs/guide.md:7']);
});

test('a pattern without hits is reported as dead', () => {
  assert.deepEqual(
    problems({ spec: { 'patterns.tsv': `${BASE_SPEC['patterns.tsv']}retired\t\\bLuna\\b\n` } }),
    ['DEAD PATTERN retired'],
  );
});

test('an additional row that disagrees with a scanned class needs a Parent override', () => {
  const additional = { 'additional/L2.tsv': 'docs/guide.md:3\tB\tsemantic review says B\n' };
  assert.deepEqual(problems({ spec: additional }), [
    'ERROR unadjudicated conflict docs/guide.md:3: scan A vs additional B',
  ]);
  assert.deepEqual(
    problems({ spec: { ...additional, 'overrides.tsv': 'docs/guide.md:3\tA+B\tParent: both\n' } }),
    [],
  );
});

test('additional rows expand line ranges and add semantic rows for unscanned lines', () => {
  const { repo, specDirectory } = fixture({
    spec: { 'additional/L2.tsv': 'scripts/tool.mjs:4-5,6\tA\tfunction body\n' },
  });
  const result = runImpact({ root: repo, specDirectory });
  assert.deepEqual(result.problems, []);
  assert.deepEqual(
    result.lines.rows.filter((row) => row.source === 'semantic').map((row) => row.key),
    ['scripts/tool.mjs:4', 'scripts/tool.mjs:6'],
  );
});

test('an override must point at an existing line', () => {
  assert.deepEqual(problems({ spec: { 'overrides.tsv': 'docs/guide.md:99\tA\tno such line\n' } }), [
    'ERROR override points to no line: docs/guide.md:99',
  ]);
});

test('a row with an unknown class or an empty reason is rejected', () => {
  const rows = BASE_SPEC['rows/L1.tsv'].replace('\tB\timport of the target module', '\tZ\t ');
  assert.equal(problems({ spec: { 'rows/L1.tsv': rows } }).length, 1);
});

test('contract selectors must match a heading or a block', () => {
  assert.deepEqual(
    problems({ spec: { 'contract-targets.tsv': 'docs/guide.md#Missing\tB\tblocks\tgone\n' } }),
    ['ERROR heading not found: docs/guide.md#Missing'],
  );
  assert.deepEqual(
    problems({ spec: { 'contract-targets.tsv': 'scripts/tool.mjs:8\tB\tblocks\tcomment\n' } }),
    ['ERROR selector matches no block: scripts/tool.mjs:8'],
  );
  assert.deepEqual(
    problems({ spec: { 'contract-targets.tsv': 'scripts/gone.mjs\tB\tfile\tremoved\n' } }),
    ['ERROR contract path missing: scripts/gone.mjs'],
  );
});

test('a row on a non-blank line outside every block fails the block layer', () => {
  assert.deepEqual(
    problems({ spec: { 'additional/L2.tsv': 'scripts/tool.mjs:8\tA\ttrailing comment\n' } }),
    ['ERROR row outside blocks: scripts/tool.mjs:8'],
  );
});

test('an active row in a file outside the universe fails the block layer', () => {
  assert.deepEqual(
    problems({ spec: { 'overrides.tsv': 'other/product.mjs:1\tA\tactually affected\n' } }),
    ['ERROR active row outside universe: other/product.mjs:1'],
  );
});

test('a review-cited line outside a block with an expected class is not covered', () => {
  const regression = `${BASE_SPEC['regression.tsv']}docs/guide.md\t7\tA\tdetails should be A\n`;
  assert.deepEqual(problems({ spec: { 'regression.tsv': regression } }), [
    'NOT COVERED docs/guide.md:7 expected A',
  ]);
});

test('consumer patterns flag blocks outside their subjects, and @exports reads file targets', () => {
  const { repo, specDirectory } = fixture({
    files: {
      'scripts/agents/mod.mjs': 'export function helper() {}\n',
      'docs/use.md': '# Use\n\nCall helper().\n',
    },
    spec: {
      'contract-targets.tsv': `${BASE_SPEC['contract-targets.tsv']}scripts/agents/mod.mjs\tB\tfile\tmodule disposition\n`,
      'consumers.tsv': '@exports:B\tB\t\tcallers of the module\n',
    },
  });
  const result = runImpact({ root: repo, specDirectory });
  assert.deepEqual(result.problems, []);
  assert.ok(
    result.blocks.flagged.some((b) => b.path === 'docs/use.md' && b.sources.has('consumer')),
  );
  assert.ok(!result.blocks.flagged.some((b) => b.path === 'scripts/agents/mod.mjs'));
});

test('CRLF sources and spec files give the same result as LF', () => {
  const lf = fixture();
  const crlf = fixture({ crlf: true });
  const a = runImpact({ root: lf.repo, specDirectory: lf.specDirectory });
  const b = runImpact({ root: crlf.repo, specDirectory: crlf.specDirectory });
  assert.deepEqual(b.problems, []);
  assert.deepEqual(b.summary, { ...a.summary });
});

test('backslash path separators in spec files are read as POSIX paths', () => {
  const rows = BASE_SPEC['rows/L1.tsv']
    .replaceAll('docs/guide.md', 'docs\\guide.md')
    .replaceAll('scripts/', 'scripts\\');
  assert.deepEqual(
    problems({
      spec: {
        'rows/L1.tsv': rows,
        'regression.tsv': '# Lane review\nscripts\\tool.mjs\t5\tA\tcited\n',
      },
    }),
    [],
  );
});

test('word boundaries follow Unicode like ripgrep and Python re', () => {
  const sol = unicodeRegExp('\\bSol\\b');
  assert.equal(sol.test('Sol은 기본'), false);
  assert.equal(sol.test('Sol 은 기본'), true);
  assert.equal(sol.test('(Sol)'), true);
  assert.equal(sol.test('Solar'), false);
});

test('globs use prefix matching for dir/** and fnmatch elsewhere', () => {
  assert.equal(globMatch('scripts/ci/codex-a/b.mjs', 'scripts/ci/codex-*'), true);
  assert.equal(globMatch('docs/a/b.md', 'docs/**'), true);
  assert.equal(globMatch('docsx/a.md', 'docs/**'), false);
  assert.equal(globMatch('AGENTS.md', 'AGENTS.md'), true);
  assert.equal(globMatch('a.md', '[ab].md'), true);
  assert.deepEqual(expandLines('3,5-7'), [3, 5, 6, 7]);
});

test('code blocks follow top-level statements through templates, regex literals and comments', () => {
  const code = [
    '#!/usr/bin/env node', // 1
    '// lead comment', // 2
    "import { a } from './a.mjs';", // 3
    '', // 4
    'const text = `', // 5
    'column zero ${a.map((x) => `${x}}`)} still text', // 6
    '}`;', // 7
    'const pattern = /["{(]/u;', // 8
    '/* block', // 9
    'comment */', // 10
    'export function f() {', // 11
    "  return '}';", // 12
    '}', // 13
    '', // 14
    '// after the last statement', // 15
  ].join('\n');
  assert.deepEqual(blockMap('x.mjs', code), [
    [1, 3],
    [4, 7],
    [8, 8],
    [9, 13],
  ]);
});

test('decorators, generic closers and own-line class braces stay in one TypeScript statement', () => {
  const code = [
    '@Injectable()', // 1
    'export class A', // 2
    '  implements B', // 3
    '{', // 4
    '  run() {}', // 5
    '}', // 6
    'type C = Pick<', // 7
    '  D,', // 8
    "  'e'", // 9
    '>;', // 10
  ].join('\n');
  assert.deepEqual(blockMap('x.ts', code), [
    [1, 6],
    [7, 10],
  ]);
});

test('Markdown, JSON and other files map to sections, root children and whole files', () => {
  assert.deepEqual(blockMap('a.md', 'intro\n# One\ntext\n## Two\ntext\n'), [
    [1, 1],
    [2, 3],
    [4, 6],
  ]);
  assert.deepEqual(blockMap('a.json', '{\n  "a": 1,\n  "b": {\n    "c": "}"\n  }\n}\n'), [
    [2, 2],
    [3, 5],
  ]);
  assert.deepEqual(blockMap('a.toml', 'a = 1\nb = 2\n'), [[1, 3]]);
  assert.deepEqual(blockMap('a.tsx', "const a = 1;\nexport const B = () => <p>it's</p>;\n"), [
    [1, 3],
  ]);
});

test('the CLI writes the inventories and exits 1 only when a check fails', () => {
  const { repo, specDirectory, root } = fixture();
  const out = resolve(root, 'out');
  assert.equal(
    main(['--spec', specDirectory, '--root', repo, '--out', out], { cwd: root, log: () => {} }),
    0,
  );
  for (const name of [
    'scan.tsv',
    'unclassified.tsv',
    'inventory.tsv',
    'blocks-inventory.tsv',
    'files-inventory.tsv',
    'summary.json',
  ]) {
    assert.ok(existsSync(resolve(out, name)), name);
  }
  assert.match(
    readFileSync(resolve(out, 'blocks-inventory.tsv'), 'utf8'),
    /^path\tstart\tend\tclasses\tsource\n/u,
  );
  writeFileSync(resolve(specDirectory, 'patterns.tsv'), 'model\t\\bSol\\b\nretired\t\\bLuna\\b\n');
  const lines = [];
  assert.equal(
    main(['--spec', specDirectory, '--root', repo, '--out', out], {
      cwd: root,
      log: (l) => lines.push(l),
    }),
    1,
  );
  assert.ok(lines.includes('DEAD PATTERN retired'));
  assert.ok(readFileSync(resolve(out, 'unclassified.tsv'), 'utf8').startsWith('# Fill class'));
});

test('the impact tool stays OS-neutral: no shell, ripgrep or subprocess other than git', () => {
  for (const path of [
    'scripts/agents/common/plan-impact.mjs',
    'scripts/agents/common/plan-impact-blocks.mjs',
  ]) {
    const source = readFileSync(resolve(repoRoot, path), 'utf8');
    const childProcess = [...source.matchAll(/import \{([^}]*)\} from 'node:child_process'/gu)];
    assert.ok(
      childProcess.every((m) => m[1].trim() === 'execFileSync'),
      path,
    );
    assert.doesNotMatch(source, /shell\s*:/u, path);
    assert.doesNotMatch(source, /['"]rg['"]/u, path);
    for (const match of source.matchAll(/execFileSync\(\s*([^,]+),/gu)) {
      assert.equal(match[1].trim(), "'git'", path);
    }
  }
});

test('the root package script runs the impact tool', () => {
  const scripts = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')).scripts;
  assert.equal(scripts['plan:impact'], 'node scripts/agents/common/plan-impact.mjs');
});
