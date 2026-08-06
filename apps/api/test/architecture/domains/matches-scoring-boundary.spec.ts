import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { matchesRoot, readSource } from './matches-boundary.support.js';

describe('Matches scoring boundary', () => {
  it('directional projection은 matches가 소유하고 pure compatibility algorithm을 소비한다', () => {
    const projectionPath = join(matchesRoot, 'scoring/match-score-projection.ts');
    const portPath = join(matchesRoot, 'application/ports/match-score-projection.port.ts');

    expect(existsSync(projectionPath)).toBe(true);
    expect(existsSync(portPath)).toBe(true);
    expect(readSource(projectionPath)).toContain('@repo/shared/profile/compatibility-scoring');
  });
});
