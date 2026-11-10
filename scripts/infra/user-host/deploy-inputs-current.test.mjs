import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = resolve(fileURLToPath(new URL('.', import.meta.url)), 'deploy-inputs-current.sh');

// main receives dev promotions as merge commits (no fast-forward), as the main ruleset requires.
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'deploy-inputs-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const write = (path, text) => {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'user.name', 'fixture');
  write('apps/web/page.tsx', 'a\n');
  write('docs/readme.md', 'a\n');
  git('add', '-A');
  git('commit', '-qm', 'base');
  const promote = (path, text) => {
    git('checkout', '-q', '-B', 'dev');
    write(path, text);
    git('add', '-A');
    git('commit', '-qm', `change ${path}`);
    git('checkout', '-q', 'main');
    git('merge', '-q', '--no-ff', 'dev', '-m', `promote ${path}`);
    return git('rev-parse', 'HEAD');
  };
  return { root, promote, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
const check = (root, run, main = 'main') =>
  spawnSync('bash', [script, run, main], { cwd: root, encoding: 'utf8' });

test('a promotion merge commit at the main head is current', () => {
  const { root, promote, cleanup } = fixture();
  try {
    const merge = promote('apps/web/page.tsx', 'b\n');
    const result = check(root, merge);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    cleanup();
  }
});

test('a newer promotion that changes a deploy input makes the older run stale', () => {
  const { root, promote, cleanup } = fixture();
  try {
    const older = promote('apps/web/page.tsx', 'b\n');
    promote('apps/web/page.tsx', 'c\n');
    assert.equal(check(root, older).status, 1);
  } finally {
    cleanup();
  }
});

test('a newer promotion outside the deploy inputs keeps the older run current', () => {
  const { root, promote, cleanup } = fixture();
  try {
    const older = promote('apps/web/page.tsx', 'b\n');
    promote('docs/readme.md', 'b\n');
    assert.equal(check(root, older).status, 0);
  } finally {
    cleanup();
  }
});

// The shared library (infra/deploy/user/ssm/lib.sh) is a web bundle input; the API bundle inputs belong to api-cd.
test('a newer API bundle change keeps the older web run current, and a web bundle change does not', () => {
  const { root, promote, cleanup } = fixture();
  try {
    const older = promote('infra/deploy/user/compose.yml', 'a\n');
    promote('infra/deploy/user/api/compose.yml', 'b\n');
    promote('infra/deploy/user/api/ssm/deploy-api.sh', 'b\n');
    assert.equal(check(root, older).status, 0);
    promote('infra/deploy/user/ssm/lib.sh', 'b\n');
    assert.equal(check(root, older).status, 1);
  } finally {
    cleanup();
  }
});

test('an unknown commit is a comparison error, not a pass', () => {
  const { root, promote, cleanup } = fixture();
  try {
    promote('apps/web/page.tsx', 'b\n');
    assert.equal(check(root, 'f'.repeat(40)).status, 2);
  } finally {
    cleanup();
  }
});
