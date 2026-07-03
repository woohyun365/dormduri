import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HomeActivityPanel } from '../components/HomeActivityPanel';
import { HomeDashboardLayout } from '../layout/HomeDashboardLayout';
import { HomeResponsiveDialog } from '../overlays/HomeResponsiveDialog';
import { HomeResponsiveSheet } from '../overlays/HomeResponsiveSheet';
import { HomeMatchingSummary } from '../components/HomeMatchingSummary';
import { HomeMatchingSummary as MatchingSectionHomeMatchingSummary } from '../sections/matching/HomeMatchingSummary';
import { HomeOperationsPanel } from '../components/HomeOperationsPanel';
import { useHomeOperations } from '../hooks/useHomeOperations';
import { HomePrimaryStateCard } from '../components/HomePrimaryStateCard';
import { HomePrimaryStateCard as PrimarySectionHomePrimaryStateCard } from '../sections/primary/HomePrimaryStateCard';
import { HomeActivityPanel as ActivitySectionHomeActivityPanel } from '../sections/activity/HomeActivityPanel';

describe('Home componentization baseline', () => {
  it('keeps public Home section facade entry points stable before internal file moves', () => {
    expect(HomePrimaryStateCard).toEqual(expect.any(Function));
    expect(HomeActivityPanel).toEqual(expect.any(Function));
    expect(HomeMatchingSummary).toEqual(expect.any(Function));
    expect(HomeOperationsPanel).toEqual(expect.any(Function));
    expect(useHomeOperations).toEqual(expect.any(Function));
    expect(HomeDashboardLayout).toEqual(expect.any(Function));
    expect(HomeResponsiveSheet).toEqual(expect.any(Function));
    expect(HomeResponsiveDialog).toEqual(expect.any(Function));
    expect(PrimarySectionHomePrimaryStateCard).toEqual(expect.any(Function));
    expect(ActivitySectionHomeActivityPanel).toEqual(expect.any(Function));
    expect(MatchingSectionHomeMatchingSummary).toEqual(expect.any(Function));
  });
});

const homeRoot = join(process.cwd(), 'src/main/tabs/home');

function readHomeSource(relativePath: string): string {
  return readFileSync(join(homeRoot, relativePath), 'utf8');
}

describe('Home primary componentization boundary', () => {
  it('keeps HomePrimaryStateCard public component as a thin compatibility facade', () => {
    const facadeSource = readHomeSource('components/HomePrimaryStateCard.tsx');

    expect(facadeSource).toContain('../sections/primary/HomePrimaryStateCard');
    expect(facadeSource).not.toContain('resolvePrimaryContent');
    expect(facadeSource).not.toContain('useState');
    expect(facadeSource).not.toContain('motion.section');
  });

  it('keeps season-state primary strategies in the primary section boundary', () => {
    const stateFiles = [
      'sections/primary/states/OffSeasonPrimaryCard.tsx',
      'sections/primary/states/SeasonOpenPrimaryCard.tsx',
      'sections/primary/states/SeasonMatchingPrimaryCard.tsx',
      'sections/primary/states/PostMatchPrimaryCard.tsx',
    ];

    expect(
      stateFiles.map((relativePath) =>
        statSync(join(homeRoot, relativePath), { throwIfNoEntry: false })?.isFile(),
      ),
    ).toEqual([true, true, true, true]);
  });

  it('keeps withdrawal sheet scroll/focus/z-index ownership in shared overlay primitives', () => {
    const withdrawalSheetSource = readHomeSource('sections/primary/PrimaryWithdrawalSheet.tsx');

    expect(withdrawalSheetSource).toContain('../../overlays/HomeResponsiveSheet');
    expect(withdrawalSheetSource).not.toContain('useBodyScrollLock');
    expect(withdrawalSheetSource).not.toContain('useFocusTrap');
    expect(withdrawalSheetSource).not.toContain('Z_INDEX');
  });
});

describe('Home activity componentization boundary', () => {
  it('keeps HomeActivityPanel public component as a thin compatibility facade', () => {
    const facadeSource = readHomeSource('components/HomeActivityPanel.tsx');

    expect(facadeSource).toContain('../sections/activity/HomeActivityPanel');
    expect(facadeSource).not.toContain('resolveSeasonOpenActivityContent');
    expect(facadeSource).not.toContain('useState');
    expect(facadeSource).not.toContain('HomeResponsiveSheet');
  });

  it('keeps activity state sections and dialogs inside the activity section boundary', () => {
    const activityFiles = [
      'sections/activity/HomeActivityPanel.tsx',
      'sections/activity/states/OffSeasonActivitySection.tsx',
      'sections/activity/states/SeasonOpenActivitySection.tsx',
      'sections/activity/states/SeasonMatchingPreparationActivitySection.tsx',
      'sections/activity/states/PostMatchActivitySection.tsx',
      'sections/activity/dialogs/OperatedDormitoryListModal.tsx',
      'sections/activity/dialogs/SeasonOpenActionModal.tsx',
      'sections/activity/dialogs/PostMatchDetailModal.tsx',
      'sections/activity/dialogs/PostMatchCounterpartProfileModal.tsx',
      'sections/activity/dialogs/OffSeasonDetailModal.tsx',
      'profile-modals/HomeProfileDetailContent.tsx',
      'profile-modals/useHomeProfileDetail.ts',
      'api/home-profile-detail.api.ts',
      'model/profile/seasonProfileDisplay.mapper.ts',
      'model/profile/profileDetailDisplay.mapper.ts',
    ];

    expect(
      activityFiles.map((relativePath) =>
        statSync(join(homeRoot, relativePath), { throwIfNoEntry: false })?.isFile(),
      ),
    ).toEqual(activityFiles.map(() => true));
  });

  it('keeps activity dialogs on shared responsive sheet primitives', () => {
    const dialogSources = [
      readHomeSource('sections/activity/dialogs/OperatedDormitoryListModal.tsx'),
      readHomeSource('sections/activity/dialogs/SeasonOpenActionModal.tsx'),
      readHomeSource('sections/activity/dialogs/PostMatchDetailModal.tsx'),
      readHomeSource('sections/activity/dialogs/PostMatchCounterpartProfileModal.tsx'),
      readHomeSource('sections/activity/dialogs/OffSeasonDetailModal.tsx'),
    ];

    for (const source of dialogSources) {
      expect(source).toContain('../../../overlays/HomeResponsiveSheet');
      expect(source).not.toContain('useBodyScrollLock');
      expect(source).not.toContain('useFocusTrap');
      expect(source).not.toContain('Z_INDEX');
    }
  });
});

describe('Home matching componentization boundary', () => {
  it('keeps HomeMatchingSummary public component as a thin compatibility facade', () => {
    const facadeSource = readHomeSource('components/HomeMatchingSummary.tsx');

    expect(facadeSource).toContain('../sections/matching/HomeMatchingSummary');
    expect(facadeSource).not.toContain('useState');
    expect(facadeSource).not.toContain('fetch(');
    expect(facadeSource).not.toContain('HomeResponsiveDialog');
  });

  it('keeps active match mutation I/O outside HomeTab composition', () => {
    const homeTabSource = readHomeSource('HomeTab.tsx');

    expect(homeTabSource).toContain('./api/home-active-match.api');
    expect(homeTabSource).not.toContain('/api/matches/active/');
    expect(homeTabSource).not.toContain('fetch(');
  });

  it('keeps matching summary owner files inside the matching section boundary', () => {
    const matchingFiles = [
      'sections/matching/HomeMatchingSummary.tsx',
      'sections/matching/ActiveMatchSummaryCard.tsx',
      'sections/matching/ActiveMatchProfileTrigger.tsx',
      'sections/matching/UnmatchActionDialog.tsx',
      'sections/matching/MatchingMetricCard.tsx',
      'sections/matching/MatchingActionList.tsx',
      'sections/matching/model/matchingSummaryContent.ts',
      'api/home-active-match.api.ts',
    ];

    expect(
      matchingFiles.map((relativePath) =>
        statSync(join(homeRoot, relativePath), { throwIfNoEntry: false })?.isFile(),
      ),
    ).toEqual(matchingFiles.map(() => true));
  });

  describe('Home operations componentization boundary', () => {
    it('keeps HomeOperationsPanel public component as a thin compatibility facade', () => {
      const facadeSource = readHomeSource('components/HomeOperationsPanel.tsx');

      expect(facadeSource).toContain('../sections/operations/HomeOperationsSurface');
      expect(facadeSource).not.toContain('useState');
      expect(facadeSource).not.toContain('fetch(');
      expect(facadeSource).not.toContain('useBodyScrollLock');
    });

    it('keeps operations hook, owner sections, and preview mapping in the Home operations boundary', () => {
      const operationsFiles = [
        'api/home-operations.api.ts',
        'hooks/useHomeOperations.ts',
        'sections/operations/HomeOperationsSurface.tsx',
        'sections/operations/HomeNoticeBanner.tsx',
        'sections/operations/NotificationInboxPreview.tsx',
        'sections/operations/SupportCenterEntry.tsx',
        'sections/operations/SupportTicketListPreview.tsx',
        'sections/operations/SupportTicketDetailSheet.tsx',
        'sections/operations/SupportTicketMessageComposer.tsx',
        'sections/operations/OperationsPanelSkeleton.tsx',
        'sections/operations/OperationsPanelErrorState.tsx',
        'model/operations/homeOperationsViewModel.ts',
        'model/operations/noticePreview.mapper.ts',
        'model/operations/notificationPreview.mapper.ts',
        'model/operations/supportPreview.mapper.ts',
      ];

      expect(
        operationsFiles.map((relativePath) =>
          statSync(join(homeRoot, relativePath), { throwIfNoEntry: false })?.isFile(),
        ),
      ).toEqual(operationsFiles.map(() => true));
    });
  });

  it('keeps unmatch dialogs on shared responsive overlay primitives without direct network I/O', () => {
    const dialogSource = readHomeSource('sections/matching/UnmatchActionDialog.tsx');
    const activeMatchSource = readHomeSource('sections/matching/ActiveMatchSummaryCard.tsx');

    expect(dialogSource).toContain('../../overlays/HomeResponsiveDialog');
    expect(dialogSource).not.toContain('fetch(');
    expect(activeMatchSource).not.toContain('fetch(');
  });
});
