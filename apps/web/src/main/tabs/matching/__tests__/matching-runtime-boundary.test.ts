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
const requestViewSource = readFileSync(
  join(matchingRoot, 'model/matching-request-view.ts'),
  'utf8',
);
const requestSectionSource = readFileSync(
  join(matchingRoot, 'sections/requests/PairRequestSection.tsx'),
  'utf8',
);
const activeViewSource = readFileSync(join(matchingRoot, 'model/matching-active-view.ts'), 'utf8');
const activeSectionSource = readFileSync(
  join(matchingRoot, 'sections/active/ActiveMatchSection.tsx'),
  'utf8',
);
const historySectionSource = readFileSync(
  join(matchingRoot, 'sections/history/MatchHistorySection.tsx'),
  'utf8',
);
const historyDetailSource = readFileSync(
  join(matchingRoot, 'history/MatchHistoryDetailContent.tsx'),
  'utf8',
);
const historyExportSource = readFileSync(join(matchingRoot, 'history/index.ts'), 'utf8');

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
    expect(mainSource).toContain('initialSection={matchingNavOptions?.section}');
  });

  it('unsupported group baseline은 current/canonical story matrix와 분리된다', () => {
    expect(currentBaselineStorySource).not.toContain('SeasonMatchingGroupLegacy');
    expect(unsupportedGroupStorySource).toContain(
      "title: 'Main/MatchingTab/Baseline/Legacy/UnsupportedGroup'",
    );
    expect(unsupportedGroupStorySource).toContain('seasonMatchingGroupLegacy');
  });

  it('pair request runtime은 client 정렬/group 상태 없이 server capability와 canonical ordering을 쓴다', () => {
    expect(requestViewSource).not.toContain('.sort(');
    expect(requestViewSource).not.toMatch(/GROUP_|groupMatching|groupSize/);
    expect(requestSectionSource).not.toMatch(/GROUP_|groupMatching|groupSize/);
    expect(requestViewSource).toContain('request.actions.canAccept');
    expect(requestViewSource).toContain('request.actions.disabledReason');
  });

  it('current active runtime은 legacy/group/local score 없이 shared capability만 사용한다', () => {
    expect(activeViewSource).toContain('CurrentActiveMatchSummary');
    expect(activeViewSource).toContain('progress.disabledReason');
    expect(activeViewSource).not.toContain('calcMatchScoreWithGating');
    expect(activeViewSource).not.toMatch(/GROUP_|groupMatching|groupSize/);
    expect(activeSectionSource).not.toContain('@/types/match');
    expect(activeSectionSource).not.toMatch(/GROUP_|groupMatching|groupSize/);
  });

  it('history runtime은 entry-id owner만 사용하고 group/chat/local score fallback을 만들지 않는다', () => {
    expect(historySectionSource).toContain('useMatchHistoryCounterpartDetail');
    expect(historySectionSource).not.toContain('/api/profiles/');
    expect(historySectionSource).not.toMatch(/GROUP_|groupMatching|groupSize|hadConversation/);
    expect(historyDetailSource).not.toContain('calcMatchScoreWithGating');
    expect(historyDetailSource).not.toContain('canStartChat');
    expect(historyExportSource).toContain('MatchHistoryDetailContent');
  });
});
