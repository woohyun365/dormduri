import { describe, expect, it } from 'vitest';

import { assessLocalRehearsalCapacity } from './local-rehearsal-capacity.mjs';

describe('local rehearsal Docker capacity', () => {
  it('accepts a 2 CPU and 4GiB Docker engine', () => {
    const assessment = assessLocalRehearsalCapacity({
      cpus: 2,
      memoryBytes: 4096 * 1024 * 1024,
      operatingSystem: 'OrbStack',
      architecture: 'aarch64',
    });

    expect(assessment).toMatchObject({
      status: 'passed',
      actualCpus: 2,
      actualMemoryMiB: 4096,
      failures: [],
    });
  });

  it('rejects a larger host instead of treating it as constrained evidence', () => {
    const assessment = assessLocalRehearsalCapacity({
      cpus: 8,
      memoryBytes: 8192 * 1024 * 1024,
      operatingSystem: 'OrbStack',
      architecture: 'aarch64',
    });

    expect(assessment.status).toBe('failed');
    expect(assessment.failures).toHaveLength(2);
  });

  it('allows a bounded memory reporting tolerance', () => {
    const assessment = assessLocalRehearsalCapacity({
      cpus: 2,
      memoryBytes: 3900 * 1024 * 1024,
      operatingSystem: 'Linux',
      architecture: 'x86_64',
    });

    expect(assessment.status).toBe('passed');
  });
});
