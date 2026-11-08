import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import test from 'node:test';

import lintStaged from 'lint-staged';

import repositoryConfig from '../../../.lintstagedrc.mjs';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

// The repository config runs unchanged; the repository binaries are put first on PATH as `pnpm lint-staged` does.
test('the repository lint-staged config formats every staged file Prettier can parse', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'knu-lint-staged-repository-config-'));
  const originalPath = process.env.PATH;
  const formatted = {
    'module.mjs': ['export const value={answer:42}\n', 'export const value = { answer: 42 };'],
    'common.cjs': ['module.exports={answer:42}\n', 'module.exports = { answer: 42 };'],
    'module.mts': ['export const value:number=42\n', 'export const value: number = 42;'],
    'source.ts': ['export const value:number=42\n', 'export const value: number = 42;'],
    'config.yaml': ['key:   [1,2]\n', 'key: [1, 2]'],
    '.github/workflows/check.yml': ['on:   push\njobs:    {}\n', 'on: push\njobs: {}'],
    'packages/tool/index.cts': ['module.exports={answer:42}\n', 'module.exports = { answer: 42 };'],
    'styles.css': ['a{color:red}\n', 'a {\n  color: red;\n}'],
    '.eslintrc.json': ['{"root":true}\n', '{ "root": true }'],
  };
  const untouched = {
    'query.sql': 'SELECT   1;\n',
    'ignored.yml': 'key:   1\n',
  };

  try {
    git(cwd, ['init', '--quiet']);
    git(cwd, ['config', 'user.name', 'dormduri lint-staged fixture']);
    git(cwd, ['config', 'user.email', 'lint-staged-fixture@example.invalid']);
    writeFileSync(join(cwd, '.prettierignore'), 'ignored.yml\n');
    git(cwd, ['add', '.prettierignore']);
    git(cwd, ['commit', '--quiet', '-m', 'fixture baseline']);

    for (const [name, [source]] of Object.entries(formatted)) {
      mkdirSync(dirname(join(cwd, name)), { recursive: true });
      writeFileSync(join(cwd, name), source);
    }
    for (const [name, source] of Object.entries(untouched)) writeFileSync(join(cwd, name), source);
    git(cwd, ['add', '--', ...Object.keys(formatted), ...Object.keys(untouched)]);

    process.env.PATH = [resolve('node_modules/.bin'), originalPath].join(delimiter);
    assert.equal(await lintStaged({ cwd, config: repositoryConfig, quiet: true }), true);
    for (const [name, [, expected]] of Object.entries(formatted))
      assert.equal(git(cwd, ['show', `:${name}`]), expected, name);
    for (const [name, source] of Object.entries(untouched))
      assert.equal(git(cwd, ['show', `:${name}`]), source.trimEnd(), name);
  } finally {
    process.env.PATH = originalPath;
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('lint-staged formats the staged snapshot and restores an unstaged hunk', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'knu-lint-staged-'));
  const fixturePath = join(cwd, 'fixture.js');
  const unrelatedPath = join(cwd, 'unrelated.js');
  const prettier = resolve('node_modules/.bin/prettier');

  try {
    git(cwd, ['init', '--quiet']);
    git(cwd, ['config', 'user.name', 'dormduri lint-staged fixture']);
    git(cwd, ['config', 'user.email', 'lint-staged-fixture@example.invalid']);

    writeFileSync(
      fixturePath,
      [
        'const fixture = {',
        '  value: 1,',
        '  paddingA: true,',
        '  paddingB: true,',
        '  paddingC: true,',
        '  unstaged: "baseline",',
        '};',
        '',
        'console.log(fixture);',
        '',
      ].join('\n'),
    );
    git(cwd, ['add', 'fixture.js']);
    git(cwd, ['commit', '--quiet', '-m', 'fixture baseline']);

    writeFileSync(
      fixturePath,
      [
        'const fixture = {',
        '  value:{nested:{answer:42}},',
        '  paddingA: true,',
        '  paddingB: true,',
        '  paddingC: true,',
        '  unstaged: "baseline",',
        '};',
        '',
        'console.log(fixture);',
        '',
      ].join('\n'),
    );
    git(cwd, ['add', 'fixture.js']);
    writeFileSync(
      fixturePath,
      [
        'const fixture = {',
        '  value:{nested:{answer:42}},',
        '  paddingA: true,',
        '  paddingB: true,',
        '  paddingC: true,',
        '  unstaged: "preserve-me",',
        '};',
        '',
        'console.log(fixture);',
        '',
      ].join('\n'),
    );
    writeFileSync(unrelatedPath, 'const unrelated={preserve:true};\n');

    const succeeded = await lintStaged({
      cwd,
      config: { '*.js': [`${prettier} --write`] },
      quiet: true,
    });

    assert.equal(succeeded, true);
    assert.equal(
      git(cwd, ['show', ':fixture.js']),
      [
        'const fixture = {',
        '  value: { nested: { answer: 42 } },',
        '  paddingA: true,',
        '  paddingB: true,',
        '  paddingC: true,',
        '  unstaged: "baseline",',
        '};',
        '',
        'console.log(fixture);',
      ].join('\n'),
    );
    assert.match(readFileSync(fixturePath, 'utf8'), /unstaged: "preserve-me"/u);
    assert.equal(git(cwd, ['diff', '--cached', '--name-only']), 'fixture.js');
    assert.equal(git(cwd, ['status', '--short', '--', 'unrelated.js']), '?? unrelated.js');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('lint-staged CLI propagates task failure without staging unrelated files', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'knu-lint-staged-failure-'));
  const fixturePath = join(cwd, 'fixture.js');
  const unrelatedPath = join(cwd, 'unrelated.js');
  const configPath = join(cwd, 'lint-staged.config.mjs');
  const lintStagedBin = resolve('node_modules/.bin/lint-staged');

  try {
    git(cwd, ['init', '--quiet']);
    git(cwd, ['config', 'user.name', 'dormduri lint-staged fixture']);
    git(cwd, ['config', 'user.email', 'lint-staged-fixture@example.invalid']);

    writeFileSync(fixturePath, 'const fixture = "baseline";\n');
    git(cwd, ['add', 'fixture.js']);
    git(cwd, ['commit', '--quiet', '-m', 'fixture baseline']);

    writeFileSync(fixturePath, 'const fixture = "staged";\n');
    writeFileSync(unrelatedPath, 'const unrelated = true;\n');
    git(cwd, ['add', 'fixture.js']);
    writeFileSync(
      configPath,
      `export default { '*.js': [${JSON.stringify(`${process.execPath} --eval "process.exit(17)"`)}] };\n`,
    );

    const result = spawnSync(lintStagedBin, ['--config', configPath, '--quiet'], {
      cwd,
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0, `expected lint-staged failure, got stdout=${result.stdout}`);
    assert.equal(git(cwd, ['show', ':fixture.js']), 'const fixture = "staged";');
    assert.equal(git(cwd, ['diff', '--cached', '--name-only']), 'fixture.js');
    assert.equal(git(cwd, ['status', '--short', '--', 'unrelated.js']), '?? unrelated.js');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
