import assert from 'node:assert/strict';
import test from 'node:test';

import { buildResourceInventory } from './github-actions-resource-inventory.mjs';

test('separates cache families, active artifacts, and package visibility', () => {
  const inventory = buildResourceInventory({
    artifacts: [
      {
        created_at: '2026-08-20T00:00:00Z',
        expired: false,
        expires_at: '2026-08-27T00:00:00Z',
        id: 1,
        name: 'web-report',
        size_in_bytes: 1024,
      },
      {
        created_at: '2026-08-19T00:00:00Z',
        expired: true,
        expires_at: '2026-08-26T00:00:00Z',
        id: 2,
        name: 'old-report',
        size_in_bytes: 2048,
      },
    ],
    caches: [
      { key: 'node-cache-Linux-x64-pnpm-lock', ref: 'refs/heads/dev', size_in_bytes: 300 },
      { key: 'Linux-next-lock-source', ref: 'refs/heads/dev', size_in_bytes: 200 },
      { key: 'Linux-X64-next-lock-config', ref: 'refs/pull/1/merge', size_in_bytes: 150 },
      { key: 'Linux-X64-web-tsc-config-source', ref: 'refs/pull/1/merge', size_in_bytes: 50 },
    ],
    collectedAt: '2026-08-26T00:00:00Z',
    packages: { reason: 'missing read:packages scope', state: 'unverified' },
    repository: 'example/repository',
  });

  assert.deepEqual(inventory.cache, {
    activeCount: 4,
    activeSizeBytes: 700,
    families: {
      next: {
        activeCount: 2,
        activeSizeBytes: 350,
        refs: ['refs/heads/dev', 'refs/pull/1/merge'],
      },
      pnpm: { activeCount: 1, activeSizeBytes: 300, refs: ['refs/heads/dev'] },
      typescript: { activeCount: 1, activeSizeBytes: 50, refs: ['refs/pull/1/merge'] },
    },
  });
  assert.deepEqual(inventory.artifacts, {
    activeCount: 1,
    activeSizeBytes: 1024,
    expiredCount: 1,
    observedRetentionDays: [7],
    totalCount: 2,
  });
  assert.equal(inventory.packages.state, 'unverified');
});
