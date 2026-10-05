#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { resolveArtifactPath } from '../../artifacts/paths.mjs';

const repoRoot = resolve(import.meta.dirname, '../../..');
const dayMilliseconds = 24 * 60 * 60 * 1_000;

function cacheFamily(key) {
  if (key.startsWith('node-cache-') && key.includes('-pnpm-')) return 'pnpm';
  if (/^Linux(?:-[A-Za-z0-9_]+)?-next-/u.test(key)) return 'next';
  if (/-(?:api|web)-tsc-/u.test(key)) return 'typescript';
  return 'other';
}

function summarizeCache(caches) {
  const families = {};
  for (const cache of caches) {
    const family = cacheFamily(cache.key);
    families[family] ??= { activeCount: 0, activeSizeBytes: 0, refs: [] };
    families[family].activeCount += 1;
    families[family].activeSizeBytes += cache.size_in_bytes;
    families[family].refs.push(cache.ref);
  }
  for (const family of Object.values(families)) {
    family.refs = [...new Set(family.refs)].sort();
  }
  return {
    activeCount: caches.length,
    activeSizeBytes: caches.reduce((total, cache) => total + cache.size_in_bytes, 0),
    families: Object.fromEntries(
      Object.entries(families).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
}

function summarizeArtifacts(artifacts) {
  const active = artifacts.filter((artifact) => artifact.expired !== true);
  const retentionDays = active
    .map((artifact) => {
      const created = Date.parse(artifact.created_at ?? '');
      const expires = Date.parse(artifact.expires_at ?? '');
      return Number.isFinite(created) && Number.isFinite(expires)
        ? Math.round((expires - created) / dayMilliseconds)
        : null;
    })
    .filter(Number.isFinite);
  return {
    activeCount: active.length,
    activeSizeBytes: active.reduce((total, artifact) => total + artifact.size_in_bytes, 0),
    expiredCount: artifacts.length - active.length,
    observedRetentionDays: [...new Set(retentionDays)].sort((left, right) => left - right),
    totalCount: artifacts.length,
  };
}

export function buildResourceInventory({ artifacts, caches, collectedAt, packages, repository }) {
  return {
    artifacts: summarizeArtifacts(artifacts),
    cache: summarizeCache(caches),
    collectedAt,
    packages,
    repository,
    schemaVersion: 1,
  };
}

function ghJson(args) {
  return JSON.parse(
    execFileSync('gh', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
}

function flattenObjectPages(pages, field) {
  return pages.flatMap((page) => page[field] ?? []);
}

function collectPackages(owner, repository) {
  try {
    const packageTypes = ['container', 'npm'];
    const items = packageTypes.flatMap((packageType) => {
      const pages = ghJson([
        'api',
        '--paginate',
        '--slurp',
        `users/${owner}/packages?package_type=${packageType}&per_page=100`,
      ]);
      return pages.flat().map((item) => ({ ...item, packageType }));
    });
    const repositoryItems = items.filter((item) => item.repository?.full_name === repository);
    return {
      count: repositoryItems.length,
      items: repositoryItems.map((item) => ({ name: item.name, packageType: item.packageType })),
      state: 'verified',
    };
  } catch {
    return { reason: 'current gh credential lacks read:packages scope', state: 'unverified' };
  }
}

export function collectResourceInventory(repository, now = new Date()) {
  const [owner] = repository.split('/');
  const cachePages = ghJson([
    'api',
    '--paginate',
    '--slurp',
    `repos/${repository}/actions/caches?per_page=100`,
  ]);
  const artifactPages = ghJson([
    'api',
    '--paginate',
    '--slurp',
    `repos/${repository}/actions/artifacts?per_page=100`,
  ]);
  return buildResourceInventory({
    artifacts: flattenObjectPages(artifactPages, 'artifacts'),
    caches: flattenObjectPages(cachePages, 'actions_caches'),
    collectedAt: now.toISOString(),
    packages: collectPackages(owner, repository),
    repository,
  });
}

function parseArgs(argv) {
  const options = { output: null, repository: null };
  for (const argument of argv) {
    if (argument === '--') continue;
    if (argument.startsWith('--repo=')) options.repository = argument.slice('--repo='.length);
    else if (argument.startsWith('--output=')) options.output = argument.slice('--output='.length);
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(options.repository ?? '')) {
    throw new Error('--repo must be owner/name');
  }
  return options;
}

function outputPathFor(output) {
  const outputPath = output
    ? resolve(repoRoot, output)
    : resolveArtifactPath(repoRoot, ['ci-performance', 'github-actions-resources.json']);
  const repositoryRelative = relative(repoRoot, outputPath);
  if (repositoryRelative.startsWith('..') || repositoryRelative === '') {
    throw new Error('--output must resolve to a file inside the repository');
  }
  return outputPath;
}

function main(argv) {
  const options = parseArgs(argv);
  const outputPath = outputPathFor(options.output);
  const inventory = collectResourceInventory(options.repository);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`);
  process.stdout.write(`${outputPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
