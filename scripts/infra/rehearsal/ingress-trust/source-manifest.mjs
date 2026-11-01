// Bind fixture evidence to Docker COPY inputs, not a mutable image tag or an advisory label.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const fixturePath = 'scripts/infra/rehearsal/ingress-trust';
const generated = new Set([
  'node_modules',
  '.turbo',
  '.next',
  'dist',
  'build',
  'coverage',
  'storybook-static',
  'playwright-report',
  'test-results',
  'logs',
]);
// Path-scoped .dockerignore rules inside the COPY roots; index.test.mjs checks every such rule.
const contextExcluded =
  /^(?:apps\/web\/playwright\/\.auth|apps\/api\/test\/stress\/(?:fixtures|reports)\/\.tmp-[^/]*)$/u;
export function sourceManifest(root, fixtureRoot = resolve(root, fixturePath)) {
  const files = {};
  const file = (absolute, name) => {
    files[name] = createHash('sha256').update(readFileSync(absolute)).digest('hex');
  };
  const walk = (name) => {
    for (const entry of readdirSync(resolve(root, name), { withFileTypes: true })) {
      const child = `${name}/${entry.name}`;
      if (
        generated.has(entry.name) ||
        entry.name.startsWith('.env') ||
        /(?:\.log|\.map|\.tsbuildinfo)$/u.test(entry.name) ||
        entry.name === '.DS_Store' ||
        contextExcluded.test(child)
      )
        continue;
      if (entry.isDirectory()) walk(child);
      else if (entry.isFile()) file(resolve(root, child), child);
      else throw new Error(`Unsupported fixture source entry: ${child}`);
    }
  };
  for (const name of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'])
    file(resolve(root, name), name);
  for (const name of ['apps/api', 'apps/web', 'packages']) walk(name);
  for (const name of readdirSync(fixtureRoot).filter(
    (name) => name === 'Dockerfile' || name.endsWith('.mjs'),
  ))
    file(resolve(fixtureRoot, name), `${fixturePath}/${name}`);
  const sorted = Object.fromEntries(
    Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'en')),
  );
  return {
    version: 1,
    files: sorted,
    sha256: createHash('sha256').update(JSON.stringify(sorted)).digest('hex'),
  };
}
export function assertSourceManifest(expected, actual) {
  assert.ok(
    actual?.version === 1 && actual?.files && actual?.sha256,
    'Missing fixture source manifest',
  );
  assert.deepEqual(
    actual,
    expected,
    'Stale or mismatched fixture image sources; rebuild the fixture',
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  writeFileSync(
    '/fixture/source-manifest.json',
    `${JSON.stringify(sourceManifest('/workspace', '/fixture'))}\n`,
  );
}
