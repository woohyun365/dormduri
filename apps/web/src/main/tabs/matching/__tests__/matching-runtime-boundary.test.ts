import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const matchingRoot = join(process.cwd(), 'src/main/tabs/matching');
const matchingTabSource = readFileSync(join(matchingRoot, 'MatchingTab.tsx'), 'utf8');
const stateMatrixSource = readFileSync(
  join(matchingRoot, 'model/matching-state-matrix.ts'),
  'utf8',
);

describe('MatchingTab runtime boundary', () => {
  it('새 state matrix는 shared season enum과 server score visibility만 소유한다', () => {
    expect(stateMatrixSource).toContain('@repo/shared/season/runtime');
    expect(stateMatrixSource).toContain('scoreVisible');
    expect(stateMatrixSource).not.toContain('calcMatchScoreWithGating');
    expect(stateMatrixSource).not.toContain('@/types/match');
    expect(stateMatrixSource).not.toContain('legacyMatchingApi');
  });

  it.fails(
    'Phase 5 red: legacy MatchingTab runtime은 local match status와 score 계산을 제거해야 한다',
    () => {
      expect(matchingTabSource).not.toContain('@/types/match');
      expect(matchingTabSource).not.toContain('calcMatchScoreWithGating');
    },
  );
});
