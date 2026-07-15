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
const chatTabSource = readFileSync(join(process.cwd(), 'src/main/tabs/chat/ChatTab.tsx'), 'utf8');
const chatRoomSource = readFileSync(
  join(process.cwd(), 'src/main/tabs/chat/ChatRoomView.tsx'),
  'utf8',
);
const legacyPairStorySource = readFileSync(
  join(matchingRoot, '__stories__/legacy/pair/LegacyMatchingTabBaseline.tsx'),
  'utf8',
);
const removedLegacyFiles = [
  'src/types/match.ts',
  'src/constants/match.ts',
  'src/utils/matchButtonStyle.ts',
  'src/utils/matchRequest.ts',
  'src/main/hooks/useMainMatchingState.ts',
  'src/main/hooks/useMainLegacyTabData.ts',
  'src/main/legacy/matchingLegacyClient.ts',
  'src/main/components/MatchRequestCard.tsx',
  'src/main/components/MatchCelebrationModal.tsx',
  'src/main/components/matching',
];

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
    expect(unsupportedGroupSnapshotSource).toMatch(/제품\s*runtime에서 사용되지 않습니다/);
    expect(unsupportedGroupSnapshotSource).not.toContain('@/types/match');
    expect(unsupportedGroupSnapshotSource).not.toContain('@/main/components');
    expect(unsupportedGroupSnapshotSource).not.toContain('fetch(');
  });

  it('Phase 13은 legacy local match model과 old matching product directory를 삭제한다', () => {
    for (const path of removedLegacyFiles) {
      expect(existsSync(join(process.cwd(), path)), `${path} must be removed`).toBe(false);
    }
  });

  it('Main과 Chat은 local match state, score, lifecycle callback을 다시 import하지 않는다', () => {
    for (const source of [mainSource, chatTabSource, chatRoomSource]) {
      expect(source).not.toContain('@/types/match');
      expect(source).not.toContain('calcMatchScoreWithGating');
      expect(source).not.toContain('main/legacy');
      expect(source).not.toContain('useMainMatchingState');
    }
    expect(chatTabSource).not.toContain('onConfirmMatch');
    expect(chatTabSource).not.toContain('onEndMatch');
    expect(chatRoomSource).not.toContain('onToggleConfirm');
    expect(chatRoomSource).not.toContain('onManageMatch');
  });

  it('legacy pair evidence는 story-local model만 사용하고 canonical runtime으로 재수출되지 않는다', () => {
    expect(legacyPairStorySource).toContain("from './model'");
    expect(legacyPairStorySource).not.toContain('@/types/match');
    expect(legacyPairStorySource).not.toContain('@/main/components/matching');
    expect(legacyPairStorySource).not.toContain('../../../../components/matching');
    for (const token of forbiddenPairOnlyTokens) {
      expect(legacyPairStorySource).not.toContain(token);
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
