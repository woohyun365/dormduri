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

  it('철회 후에도 등록 완료 이력이 있는 시즌을 materialization 대상으로 유지한다', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/matches/history/materialization/ended-season-history.loader.ts'),
      'utf8',
    );

    expect(source).toContain('registeredAt: { not: null }');
    expect(source).not.toContain("participationIntent: 'REGISTERED'");
  });
});
