import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../../..');
const webRoot = resolve(repoRoot, 'apps/web');
const nextRoot = resolve(webRoot, '.next');
const publicRoots = [resolve(nextRoot, 'static'), resolve(webRoot, 'public')];
const artifactRoots = [...publicRoots, resolve(nextRoot, 'standalone')];
const secretSentinel = process.env.SENTRY_ARTIFACT_SECRET_SENTINEL;

function walk(root) {
  try {
    if (!statSync(root).isDirectory()) return [];
  } catch {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const target = join(root, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const buildIdPath = resolve(nextRoot, 'BUILD_ID');
assert(statSync(buildIdPath).isFile(), 'Next production build is missing apps/web/.next/BUILD_ID.');

const publicFiles = publicRoots.flatMap(walk);
const publicMaps = publicFiles.filter((file) => extname(file) === '.map');
assert(
  publicMaps.length === 0,
  `Public source maps must be absent when upload is disabled: ${publicMaps
    .map((file) => relative(repoRoot, file))
    .join(', ')}`,
);

const inspectableFiles = artifactRoots
  .flatMap(walk)
  .filter((file) => ['.js', '.json', '.html', '.txt'].includes(extname(file)));
const leakedFiles = [];
for (const file of inspectableFiles) {
  const content = readFileSync(file, 'utf8');
  const leaked = secretSentinel ? content.includes(secretSentinel) : false;
  if (leaked) leakedFiles.push(relative(repoRoot, file));
}
assert(
  leakedFiles.length === 0,
  `Sentry build secret leaked into artifact: ${leakedFiles.join(', ')}`,
);

process.stdout.write(
  `${JSON.stringify(
    {
      buildId: readFileSync(buildIdPath, 'utf8').trim(),
      inspectedFiles: inspectableFiles.length,
      publicSourceMaps: publicMaps.length,
      secretLeakFiles: leakedFiles.length,
    },
    null,
    2,
  )}\n`,
);
