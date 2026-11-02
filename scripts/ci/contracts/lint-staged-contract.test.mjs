import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import lintStaged from 'lint-staged';

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

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
