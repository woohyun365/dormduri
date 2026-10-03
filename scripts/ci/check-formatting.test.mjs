import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { prettierArguments } from './check-formatting.mjs';

const script = fileURLToPath(new URL('./check-formatting.mjs', import.meta.url));
const FULL = ['.', '-c'];

function workspace(files) {
  const root = mkdtempSync(join(tmpdir(), 'knu-check-formatting-'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function run(root, env) {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, FORMATTING_SCOPE: '', FORMATTING_PATHS: '', ...env },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test('anything but a well-formed changed scope checks the whole tree', () => {
  for (const input of [
    { scope: 'full', pathsJson: '[]' },
    { scope: '', pathsJson: '["docs/a.md"]' },
    { scope: undefined, pathsJson: undefined },
    { scope: 'changed', pathsJson: undefined },
    { scope: 'changed', pathsJson: '{not json' },
    { scope: 'changed', pathsJson: '{"path":"docs/a.md"}' },
    { scope: 'changed', pathsJson: '["docs/a.md", 1]' },
    { scope: 'changed', pathsJson: '["docs/a.md", ""]' },
  ]) {
    assert.deepEqual(prettierArguments(input), FULL, JSON.stringify(input));
  }
});

test('deleted paths and rename sources are dropped; rename destinations are checked', () => {
  const root = workspace({ 'docs/kept.md': '# Kept\n', 'docs/renamed.md': '# Renamed\n' });
  try {
    assert.deepEqual(
      prettierArguments({
        scope: 'changed',
        pathsJson: JSON.stringify([
          'docs/deleted.md',
          'docs/kept.md',
          'docs/rename-source.md',
          'docs/renamed.md',
          'docs',
        ]),
        cwd: root,
      }),
      ['-c', '--ignore-unknown', '--', 'docs/kept.md', 'docs/renamed.md'],
    );
    assert.equal(
      prettierArguments({ scope: 'changed', pathsJson: '["docs/deleted.md"]', cwd: root }),
      null,
    );
    assert.equal(prettierArguments({ scope: 'changed', pathsJson: '[]', cwd: root }), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the changed scope checks only listed files with Prettier', () => {
  const root = workspace({
    '.prettierrc': '{ "singleQuote": true }\n',
    '.prettierignore': 'ignored/\n',
    'app/[id]/page.ts': "export const page = 'ok';\n",
    'app/[id]/broken.ts': 'export const broken = {a:"x"}\n',
    'untouched/broken.ts': 'export const untouched = {a:"x"}\n',
    'ignored/broken.ts': 'export const ignored = {a:"x"}\n',
    'notes.unknownext': 'not  formatted\n',
  });
  try {
    const changed = (paths) =>
      run(root, { FORMATTING_SCOPE: 'changed', FORMATTING_PATHS: JSON.stringify(paths) });

    const clean = changed([
      'app/[id]/page.ts',
      'ignored/broken.ts',
      'notes.unknownext',
      'removed/file.ts',
    ]);
    assert.equal(clean.status, 0, clean.output);
    assert.match(clean.output, /Formatting scope: changed \(3 files\)/u);

    const broken = changed(['app/[id]/page.ts', 'app/[id]/broken.ts']);
    assert.equal(broken.status, 1, broken.output);
    assert.match(broken.output, /app\/\[id\]\/broken\.ts/u);
    assert.doesNotMatch(broken.output, /untouched/u);

    const nothingLeft = changed(['removed/file.ts']);
    assert.equal(nothingLeft.status, 0, nothingLeft.output);
    assert.match(nothingLeft.output, /formatting check skipped/u);

    const full = run(root, { FORMATTING_SCOPE: 'full', FORMATTING_PATHS: '[]' });
    assert.equal(full.status, 1, full.output);
    assert.match(full.output, /Formatting scope: full/u);
    assert.match(full.output, /untouched\/broken\.ts/u);
    assert.doesNotMatch(full.output, /ignored\/broken\.ts/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
