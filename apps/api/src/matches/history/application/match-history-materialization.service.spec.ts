import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('MatchHistoryMaterializationService', () => {
  const sourcePath = join(
    process.cwd(),
    'src/matches/history/application/match-history-materialization.service.ts',
  );

  it('owns serializable orchestration for ended-season history rebuilds', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('implements MatchHistoryMaterializationPort');
    expect(source).toContain('findEndedSeasonIds');
    expect(source).toContain('runSerializableTransaction');
    expect(source).toContain('rebuildSeasonHistoryEntries');
  });
});
