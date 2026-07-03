import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HomeActivityPanel } from '../sections/activity/HomeActivityPanel';
import { HomeDashboardLayout } from '../layout/HomeDashboardLayout';
import { HomeDashboardErrorState } from '../layout/HomeDashboardErrorState';
import { HomeHeader } from '../layout/HomeHeader';
import { HomeNonOperatedOverlay } from '../layout/HomeNonOperatedOverlay';
import { HomeSectionGrid } from '../layout/HomeSectionGrid';
import { HomeResponsiveDialog } from '../overlays/HomeResponsiveDialog';
import { HomeResponsiveSheet } from '../overlays/HomeResponsiveSheet';
import { HomeMatchingSummary } from '../sections/matching/HomeMatchingSummary';
import { HomeOperationsSurface } from '../sections/operations/HomeOperationsSurface';
import { HomeReadinessChecklist } from '../sections/readiness/HomeReadinessChecklist';
import { HomeMatchingRegisteredGuidePanel } from '../sections/readiness/HomeMatchingRegisteredGuidePanel';
import { HomeQuickMenuSection } from '../sections/quick-actions/HomeQuickMenuSection';
import { useHomeOperations } from '../hooks/useHomeOperations';
import { HomePrimaryStateCard } from '../sections/primary/HomePrimaryStateCard';

describe('Home componentization baseline', () => {
  it('keeps Home section owner entry points available without component compatibility facades', () => {
    expect(HomePrimaryStateCard).toEqual(expect.any(Function));
    expect(HomeActivityPanel).toEqual(expect.any(Function));
    expect(HomeMatchingSummary).toEqual(expect.any(Function));
    expect(HomeOperationsSurface).toEqual(expect.any(Function));
    expect(HomeReadinessChecklist).toEqual(expect.any(Function));
    expect(HomeMatchingRegisteredGuidePanel).toEqual(expect.any(Function));
    expect(HomeQuickMenuSection).toEqual(expect.any(Function));
    expect(useHomeOperations).toEqual(expect.any(Function));
    expect(HomeDashboardLayout).toEqual(expect.any(Function));
    expect(HomeDashboardErrorState).toEqual(expect.any(Function));
    expect(HomeHeader).toEqual(expect.any(Function));
    expect(HomeNonOperatedOverlay).toEqual(expect.any(Function));
    expect(HomeSectionGrid).toEqual(expect.any(Function));
    expect(HomeResponsiveSheet).toEqual(expect.any(Function));
    expect(HomeResponsiveDialog).toEqual(expect.any(Function));
  });
});

const homeRoot = join(process.cwd(), 'src/main/tabs/home');

function readHomeSource(relativePath: string): string {
  return readFileSync(join(homeRoot, relativePath), 'utf8');
}

function homePathExists(relativePath: string): boolean {
  return statSync(join(homeRoot, relativePath), { throwIfNoEntry: false })?.isFile() ?? false;
}

describe('Home shell componentization boundary', () => {
  it('keeps HomeTab focused on composition while header and non-operated overlay live in layout', () => {
    const homeTabSource = readHomeSource('HomeTab.tsx');

    expect(homeTabSource).toContain('./layout/HomeHeader');
    expect(homeTabSource).toContain('./layout/HomeNonOperatedOverlay');
    expect(homeTabSource).not.toContain('getAvatarColor');
    expect(homeTabSource).not.toContain('motion.button');
    expect(homeTabSource).not.toContain('ShieldAlert');
  });

  it('keeps shell layout owner files in the layout boundary', () => {
    const layoutFiles = [
      'layout/HomeDashboardLayout.tsx',
      'layout/HomeHeader.tsx',
      'layout/HomeNonOperatedOverlay.tsx',
      'layout/HomeSectionGrid.tsx',
    ];

    expect(layoutFiles.map(homePathExists)).toEqual(layoutFiles.map(() => true));
  });
});

describe('Home stale compatibility cleanup boundary', () => {
  it('removes legacy standalone widgets and Home-local service-intro compatibility files from Home runtime', () => {
    const removedFiles = [
      'components/BuildingStatsBar.tsx',
      'components/DynamicTipBanner.tsx',
      'components/HomeStatsPanel.tsx',
      'components/HomeStatusTip.tsx',
      'components/UrgentActionBanner.tsx',
      'components/HomeOnboardingSheet.tsx',
      'components/HomePrimaryStateCard.tsx',
      'components/HomeActivityPanel.tsx',
      'components/HomeMatchingSummary.tsx',
      'components/HomeOperationsPanel.tsx',
      'components/HomeDashboardErrorState.tsx',
      'components/HomeReadinessChecklist.tsx',
      'components/HomeMatchingRegisteredGuidePanel.tsx',
      'components/HomeQuickMenuSection.tsx',
      'hooks/useHomeOnboardingNotice.ts',
      'api/home-onboarding-notice.api.ts',
    ];

    expect(removedFiles.map(homePathExists)).toEqual(removedFiles.map(() => false));
  });

  it('keeps Home dashboard view model free from component-owned tip types', () => {
    const viewModelSource = readHomeSource('model/homeDashboardViewModel.ts');

    expect(viewModelSource).toContain('./homeStatusTipTypes');
    expect(viewModelSource).not.toContain('../components/DynamicTipBanner');
  });
});

describe('Home primary componentization boundary', () => {
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

describe('Home readiness and quick-action componentization boundary', () => {
  it('removes import-only readiness and quick-action compatibility facades', () => {
    const removedFacadeFiles = [
      'components/HomeReadinessChecklist.tsx',
      'components/HomeMatchingRegisteredGuidePanel.tsx',
      'components/HomeQuickMenuSection.tsx',
    ];

    expect(removedFacadeFiles.map(homePathExists)).toEqual(removedFacadeFiles.map(() => false));
  });

  it('keeps readiness and quick-action owners inside their section boundaries', () => {
    const sectionFiles = [
      'sections/readiness/HomeReadinessChecklist.tsx',
      'sections/readiness/HomeMatchingRegisteredGuidePanel.tsx',
      'sections/quick-actions/HomeQuickMenuSection.tsx',
    ];

    expect(sectionFiles.map(homePathExists)).toEqual(sectionFiles.map(() => true));
  });
});

describe('Home matching componentization boundary', () => {
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
    it('keeps operations hook, owner sections, and preview mapping in the Home operations boundary', () => {
      const operationsFiles = [
        'api/home-operations.api.ts',
        'hooks/useHomeOperations.ts',
        'sections/operations/HomeOperationsSurface.tsx',
        'sections/operations/HomeNoticeSurface.tsx',
        'sections/operations/HomeInboxSupportSection.tsx',
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
