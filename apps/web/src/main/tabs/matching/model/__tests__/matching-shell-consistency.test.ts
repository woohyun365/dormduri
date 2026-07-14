import { describe, expect, it } from 'vitest';
import { resolveMatchingShellConsistency } from '../matching-shell-consistency';

describe('matching shell consistency', () => {
  const shell = { id: 'season-1', state: 'SEASON_MATCHING' } as const;

  it('dashboard shell과 overview season이 같으면 정상 상태를 유지한다', () => {
    expect(
      resolveMatchingShellConsistency({
        shell,
        overview: { id: 'season-1', state: 'SEASON_MATCHING', roomSelectionDate: null },
        consecutiveMismatchCount: 2,
      }),
    ).toEqual({ kind: 'consistent', nextMismatchCount: 0 });
  });

  it('첫 mismatch는 dashboard 전환 중 상태로 보고 한 번 재확인한다', () => {
    expect(
      resolveMatchingShellConsistency({
        shell,
        overview: { id: 'season-2', state: 'SEASON_OPEN', roomSelectionDate: null },
        consecutiveMismatchCount: 0,
      }),
    ).toEqual({ kind: 'transitioning', nextMismatchCount: 1 });
  });

  it('반복 mismatch는 local season을 합성하지 않고 명시적 mismatch로 닫는다', () => {
    expect(
      resolveMatchingShellConsistency({
        shell,
        overview: { id: 'season-2', state: 'SEASON_OPEN', roomSelectionDate: null },
        consecutiveMismatchCount: 1,
      }),
    ).toEqual({ kind: 'mismatch', nextMismatchCount: 2 });
  });
});
