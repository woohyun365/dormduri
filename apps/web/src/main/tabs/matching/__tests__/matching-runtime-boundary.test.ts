import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const matchingRoot = join(process.cwd(), 'src/main/tabs/matching');
const matchingTabSource = readFileSync(join(matchingRoot, 'MatchingTab.tsx'), 'utf8');
const stateMatrixSource = readFileSync(
  join(matchingRoot, 'model/matching-state-matrix.ts'),
  'utf8',
);
const mainSource = readFileSync(join(process.cwd(), 'src/main/Main.tsx'), 'utf8');
const currentBaselineStorySource = readFileSync(
  join(matchingRoot, '__stories__/MatchingTab.baseline-current.stories.tsx'),
  'utf8',
);
const unsupportedGroupStorySource = readFileSync(
  join(matchingRoot, '__stories__/MatchingTab.baseline-unsupported-group.stories.tsx'),
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

  it('canonical MatchingTab은 local status, score, legacy/story dependency를 사용하지 않는다', () => {
    expect(matchingTabSource).not.toContain('@/types/match');
    expect(matchingTabSource).not.toContain('calcMatchScoreWithGating');
    expect(matchingTabSource).not.toContain('matchingLegacyClient');
    expect(matchingTabSource).not.toContain('__stories__');
  });

  it('Main은 canonical MatchingTab만 mount하고 별도 runtime entry를 두지 않는다', () => {
    expect(mainSource).toContain("import MatchingTab from './tabs/matching/MatchingTab'");
    expect(mainSource).not.toContain('MatchingRuntimeTab');
    expect(existsSync(join(matchingRoot, 'MatchingRuntimeTab.tsx'))).toBe(false);
  });

  it('unsupported group baseline은 current/canonical story matrix와 분리된다', () => {
    expect(currentBaselineStorySource).not.toContain('SeasonMatchingGroupLegacy');
    expect(unsupportedGroupStorySource).toContain(
      "title: 'Main/MatchingTab/Baseline/Legacy/UnsupportedGroup'",
    );
    expect(unsupportedGroupStorySource).toContain('seasonMatchingGroupLegacy');
  });
});
