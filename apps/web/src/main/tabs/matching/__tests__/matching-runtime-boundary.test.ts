import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const matchingRoot = join(process.cwd(), 'src/main/tabs/matching');
const matchingTabSource = readFileSync(join(matchingRoot, 'MatchingTab.tsx'), 'utf8');
const stateMatrixSource = readFileSync(
  join(matchingRoot, 'model/matching-state-matrix.ts'),
  'utf8',
);
const mainSource = readFileSync(join(process.cwd(), 'src/main/Main.tsx'), 'utf8');
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
  join(matchingRoot, 'sections/history/HistoryEntryDialog.tsx'),
  'utf8',
);
const sectionTabsSource = readFileSync(
  join(matchingRoot, 'components/pair/PairMatchingSectionTabs.tsx'),
  'utf8',
);
const requestCardSource = readFileSync(
  join(matchingRoot, 'components/pair/PairRequestCard.tsx'),
  'utf8',
);
const sharedHeaderFrame = join(process.cwd(), 'src/main/components/layout/MainTabHeaderFrame.tsx');
const roommateHeaderSource = readFileSync(
  join(process.cwd(), 'src/main/tabs/roommate-list/sections/header/RoommateSearchHeader.tsx'),
  'utf8',
);
const pairPresentationFiles = [
  'components/pair/PairMatchingIdentityHeader.tsx',
  'components/pair/PairMatchingSectionTabs.tsx',
  'components/pair/PairRequestTabs.tsx',
  'components/pair/PairRequestOrderControl.tsx',
  'components/pair/PairRequestCard.tsx',
  'components/pair/PairActiveMatchCard.tsx',
  'components/pair/PairMatchingFlowTipCard.tsx',
] as const;
const canonicalProductSourceEntries = readdirSync(matchingRoot, { recursive: true }).flatMap(
  (entry) => (typeof entry === 'string' ? [entry] : []),
);
const canonicalProductSources = canonicalProductSourceEntries
  .filter((entry) => /\.(?:ts|tsx)$/u.test(entry))
  .filter((entry) => !entry.includes('__stories__') && !entry.includes('__tests__'))
  .map((entry) => ({
    file: join(matchingRoot, entry),
    source: readFileSync(join(matchingRoot, entry), 'utf8'),
  }));
const pairOnlyProductSources = [
  join(process.cwd(), 'src/types/match.ts'),
  join(process.cwd(), 'src/constants/dormitory.ts'),
  join(process.cwd(), 'src/constants/index.ts'),
  join(process.cwd(), 'src/main/tabs/chat/chatViewModel.ts'),
  join(process.cwd(), 'src/main/tabs/chat/ChatTab.tsx'),
  join(process.cwd(), 'src/main/tabs/chat/ChatRoomView.tsx'),
  join(process.cwd(), 'src/main/tabs/home/model/homeDashboardViewModel.ts'),
  join(process.cwd(), 'src/main/tabs/home/sections/matching/HomeMatchingSummary.tsx'),
  join(process.cwd(), 'src/utils/matchButtonStyle.ts'),
  join(process.cwd(), 'src/utils/matchRequest.ts'),
]
  .filter(existsSync)
  .map((file) => ({ file, source: readFileSync(file, 'utf8') }));

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
];

describe('MatchingTab runtime boundary', () => {
  it('RoommateTab과 MatchingTab은 공통 header frame을 쓰고 pair UI를 feature 내부에 둔다', () => {
    expect(existsSync(sharedHeaderFrame)).toBe(true);
    expect(roommateHeaderSource).toContain('MainTabHeaderFrame');
    expect(readFileSync(join(matchingRoot, 'layout/MatchingTabHeader.tsx'), 'utf8')).toContain(
      'MainTabHeaderFrame',
    );
    expect(pairPresentationFiles.filter((file) => !existsSync(join(matchingRoot, file)))).toEqual(
      [],
    );
  });

  it('새 state matrix는 shared season enum과 server score visibility만 소유한다', () => {
    expect(stateMatrixSource).toContain('@repo/shared/season/runtime');
    expect(stateMatrixSource).toContain('scoreVisible');
    expect(stateMatrixSource).not.toContain('calcMatchScoreWithGating');
    expect(stateMatrixSource).not.toContain('@/types/match');
  });

  it('canonical MatchingTab은 local status, score, story dependency를 사용하지 않는다', () => {
    expect(matchingTabSource).not.toContain('@/types/match');
    expect(matchingTabSource).not.toContain('calcMatchScoreWithGating');
    expect(matchingTabSource).not.toContain('__stories__');
  });

  it('canonical presentation은 local matching model·score·story dependency를 사용하지 않는다', () => {
    for (const { file, source } of canonicalProductSources) {
      expect(source, `${file} must not import local legacy match type`).not.toContain(
        '@/types/match',
      );
      expect(source, `${file} must not calculate a local match score`).not.toContain(
        'calcMatchScoreWithGating',
      );
      expect(source, `${file} must not import Storybook fixtures`).not.toContain('__stories__');
    }
  });

  it('Main은 canonical MatchingTab만 mount하고 별도 runtime entry를 두지 않는다', () => {
    expect(mainSource).toContain("import MatchingTab from './tabs/matching/MatchingTab'");
    expect(mainSource).not.toContain('MatchingRuntimeTab');
    expect(mainSource).toContain('initialSection={matchingNavOptions?.section}');
  });

  it('shipping compatibility는 pair-only 토큰을 만들지 않는다', () => {
    for (const { file, source } of pairOnlyProductSources) {
      for (const token of forbiddenPairOnlyTokens) {
        expect(source, `${file} must not contain ${token}`).not.toContain(token);
      }
    }
  });

  it('pair request runtime은 server capability를 유지하고 받은 요청 정렬은 표시용 복사본에만 적용한다', () => {
    expect(requestViewSource).not.toContain('.sort(');
    expect(requestViewSource).not.toMatch(/GROUP_|groupMatching|groupSize/);
    expect(requestSectionSource).not.toMatch(/GROUP_|groupMatching|groupSize/);
    expect(requestSectionSource).toContain('orderReceivedMatchRequests');
    expect(requestViewSource).toContain('request.actions.accept');
    expect(requestViewSource).toContain('decision.reason');
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
    expect(historyDetailSource).toContain('RoommateProfileDetailDialog');
    expect(historyDetailSource).toContain('MATCHING_HISTORY_DETAIL_UNAVAILABLE');
    expect(historyDetailSource).not.toContain('BaseBottomSheet');
  });

  it('pair surface는 manual tabs, direct action, reduced motion을 유지한다', () => {
    expect(sectionTabsSource).toContain("event.key === 'ArrowRight'");
    expect(sectionTabsSource).toContain("event.key === 'Enter' || event.key === ' '");
    expect(sectionTabsSource).toContain('motion-reduce:transition-none');
    expect(requestCardSource).toContain('matching-request-direct-actions');
    expect(requestCardSource).not.toContain('aria-haspopup');
    expect(matchingTabSource).not.toMatch(/auto.?rotat|setInterval|requestAnimationFrame/i);
  });
});
