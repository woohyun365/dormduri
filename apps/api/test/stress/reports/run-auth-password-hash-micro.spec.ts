import { describe, expect, it } from 'vitest';

import { runAuthPasswordHashMicroBenchmark } from './run-auth-password-hash-micro.js';

describe('auth password hash micro report', () => {
  it('keeps only bounded timing and RSS evidence', async () => {
    let rss = 100;
    const report = await runAuthPasswordHashMicroBenchmark([1, 5], {
      hashOperation: () => {
        rss += 10;
        return Promise.resolve();
      },
      readRss: () => rss,
    });

    expect(report.argon2).toEqual({ memoryCostKiB: 19456, timeCost: 2, parallelism: 1 });
    expect(report.levels.map((entry) => entry.concurrency)).toEqual([1, 5]);
    expect(report.levels.every((entry) => entry.failed === 0)).toBe(true);
    expect(JSON.stringify(report)).not.toContain('Capacity!Micro2026');
    expect(JSON.stringify(report)).not.toContain('$argon2');
  });
});
