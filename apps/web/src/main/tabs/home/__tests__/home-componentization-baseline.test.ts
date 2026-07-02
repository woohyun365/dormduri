import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HomeActivityPanel } from '../components/HomeActivityPanel';
import { HomeDashboardLayout } from '../layout/HomeDashboardLayout';
import { HomeResponsiveDialog } from '../overlays/HomeResponsiveDialog';
import { HomeResponsiveSheet } from '../overlays/HomeResponsiveSheet';
import { HomeMatchingSummary } from '../components/HomeMatchingSummary';
import { HomeOperationsPanel } from '../components/HomeOperationsPanel';
import { HomePrimaryStateCard } from '../components/HomePrimaryStateCard';
import { HomePrimaryStateCard as PrimarySectionHomePrimaryStateCard } from '../sections/primary/HomePrimaryStateCard';

describe('Home componentization baseline', () => {
  it('keeps public Home section facade entry points stable before internal file moves', () => {
    expect(HomePrimaryStateCard).toEqual(expect.any(Function));
    expect(HomeActivityPanel).toEqual(expect.any(Function));
    expect(HomeMatchingSummary).toEqual(expect.any(Function));
    expect(HomeOperationsPanel).toEqual(expect.any(Function));
    expect(HomeDashboardLayout).toEqual(expect.any(Function));
    expect(HomeResponsiveSheet).toEqual(expect.any(Function));
    expect(HomeResponsiveDialog).toEqual(expect.any(Function));
    expect(PrimarySectionHomePrimaryStateCard).toEqual(expect.any(Function));
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
