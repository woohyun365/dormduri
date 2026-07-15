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
const unsupportedGroupSnapshotSource = readFileSync(
  join(matchingRoot, '__stories__/legacy/unsupported-group/UnsupportedGroupLegacySnapshot.tsx'),
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
const sectionTabsSource = readFileSync(
  join(matchingRoot, 'components/MatchingSectionTabs.tsx'),
  'utf8',
);
const requestCardSource = readFileSync(
  join(matchingRoot, 'components/MatchRequestSummaryCard.tsx'),
  'utf8',
);
const pairOnlyProductSources = [
  join(process.cwd(), 'src/types/match.ts'),
  join(process.cwd(), 'src/constants/dormitory.ts'),
  join(process.cwd(), 'src/constants/index.ts'),
  join(process.cwd(), 'src/main/hooks/useMainMatchingState.ts'),
  join(process.cwd(), 'src/main/legacy/matchingLegacyClient.ts'),
  join(process.cwd(), 'src/main/components/MatchRequestCard.tsx'),
  join(process.cwd(), 'src/main/components/MatchCelebrationModal.tsx'),
  join(process.cwd(), 'src/main/components/matching/MatchingCompactCard.tsx'),
  join(process.cwd(), 'src/main/components/matching/ActiveMatchCard.tsx'),
  join(process.cwd(), 'src/main/components/matching/PastSeasonAccordion.tsx'),
  join(process.cwd(), 'src/main/components/matching/policyCopy.ts'),
  join(process.cwd(), 'src/main/tabs/chat/chatViewModel.ts'),
  join(process.cwd(), 'src/main/tabs/chat/ChatTab.tsx'),
  join(process.cwd(), 'src/main/tabs/chat/ChatRoomView.tsx'),
  join(process.cwd(), 'src/main/tabs/home/model/homeDashboardViewModel.ts'),
  join(process.cwd(), 'src/main/tabs/home/sections/matching/HomeMatchingSummary.tsx'),
  join(process.cwd(), 'src/utils/matchButtonStyle.ts'),
  join(process.cwd(), 'src/utils/matchRequest.ts'),
  join(matchingRoot, '__stories__/matching-story-scenarios.ts'),
  join(matchingRoot, '__stories__/matching-story-renderer.tsx'),
  join(matchingRoot, '__stories__/legacy/LegacyMatchingTabBaseline.tsx'),
].map((file) => ({ file, source: readFileSync(file, 'utf8') }));

const forbiddenPairOnlyTokens = [
  'PAIR_OPEN',
  'PAIR_FINAL',
  'GROUP_FORMING',
  'GROUP_FINAL',
  'GROUP_CONV_JOIN',
  'groupTargetUserIds',
  'approvalUserIds',
  'cancelApprovalUserIds',
  'groupStage',
  'groupMemberCount',
  'groupCapacity',
  'groupMembers',
  'getMatchGroupSize',
  'finalizePairGroup',
  'onFinalizePairGroup',
  'GroupInfoTipCard',
];

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
    expect(unsupportedGroupStorySource).toContain('UnsupportedGroupLegacySnapshot');
    expect(unsupportedGroupStorySource).not.toContain('matching-story-scenarios');
    expect(unsupportedGroupSnapshotSource).toContain('제품 runtime에서 사용되지 않습니다');
    expect(unsupportedGroupSnapshotSource).not.toContain('@/types/match');
    expect(unsupportedGroupSnapshotSource).not.toContain('@/main/components');
    expect(unsupportedGroupSnapshotSource).not.toContain('fetch(');
  });

  it('shipping compatibility와 current story fixture는 pair-only 토큰을 만들지 않는다', () => {
    for (const { file, source } of pairOnlyProductSources) {
      for (const token of forbiddenPairOnlyTokens) {
        expect(source, `${file} must not contain ${token}`).not.toContain(token);
      }
    }
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

  it('Phase 10 canonical surface는 manual tabs, direct action, reduced motion만 사용한다', () => {
    expect(sectionTabsSource).toContain("event.key === 'ArrowRight'");
    expect(sectionTabsSource).toContain("event.key === 'Enter' || event.key === ' '");
    expect(sectionTabsSource).toContain('motion-reduce:transition-none');
    expect(requestCardSource).toContain('matching-request-direct-actions');
    expect(requestCardSource).not.toContain('aria-haspopup');
    expect(matchingTabSource).not.toMatch(/auto.?rotat|setInterval|requestAnimationFrame/i);
  });
});
