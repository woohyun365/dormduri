import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { prepareNextStandalone } from './prepare-next-standalone.mjs';

function createWebFixture() {
  const root = mkdtempSync(join(tmpdir(), 'knu-next-standalone-'));
  mkdirSync(join(root, '.next/standalone/apps/web'), { recursive: true });
  mkdirSync(join(root, '.next/static/chunks'), { recursive: true });
  mkdirSync(join(root, 'public'), { recursive: true });
  writeFileSync(join(root, '.next/static/chunks/app.js'), 'static-artifact');
  writeFileSync(join(root, 'public/logo.svg'), 'public-artifact');
  return root;
}

test('copies static and public assets into the prebuilt standalone tree', () => {
  const root = createWebFixture();

  try {
    const result = prepareNextStandalone(root);

    assert.equal(
      readFileSync(join(result.staticTarget, 'chunks/app.js'), 'utf8'),
      'static-artifact',
    );
    assert.equal(readFileSync(join(result.publicTarget, 'logo.svg'), 'utf8'), 'public-artifact');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails before browser smoke when the Next static artifact is missing', () => {
  const root = createWebFixture();
  rmSync(join(root, '.next/static'), { recursive: true, force: true });

  try {
    assert.throws(() => prepareNextStandalone(root), /Next static artifact가 없습니다/);
    assert.equal(existsSync(join(root, '.next/standalone/apps/web/.next/static')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fails before browser smoke when the public artifact is missing', () => {
  const root = createWebFixture();
  rmSync(join(root, 'public'), { recursive: true, force: true });

  try {
    assert.throws(() => prepareNextStandalone(root), /Web public artifact가 없습니다/);
    assert.equal(existsSync(join(root, '.next/standalone/apps/web/public')), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
