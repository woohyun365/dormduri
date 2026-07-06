import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const roommateRoot = join(process.cwd(), 'src/main/tabs/roommate-list');
const mainRuntimeSource = join(process.cwd(), 'src/main/Main.tsx');

function importPath(...parts: string[]): string {
  return parts.join('');
}

const FORBIDDEN_ROOMMATE_RUNTIME_PATTERNS = [
  importPath('@', '/api/profile'),
  'profileApi.getProfiles',
  importPath('@', '/main/dev-only/fixtures'),
  'main/dev-only',
  'mockRawProfiles',
  'mockDb',
  'calcMatchScoreWithGating',
  'ProfileDetailSheet',
  'DEFAULT_FILTERS',
  'FilterState',
  '@/main/components/BottomSheet',
  'drinkingFrequency',
  'drinkingTolerance',
  'targetCondition',
  'viewerValue',
  'targetValue',
  'matrixKey',
  'bookmarkedUserIds',
  'blockedUserIds',
  'displayCount',
  'slice(0',
] as const;

const FORBIDDEN_MAIN_LIST_BRIDGE_PATTERNS = [
  "LEGACY_DATA_TABS = new Set<TabId>(['list'",
  'LEGACY_DATA_TABS = new Set<TabId>(["list"',
  "activeTab === 'list' && legacyData",
  'profiles={legacyData.profiles}',
  'filters={listViewState.filters}',
  'onFiltersChange={listViewState.setFilters}',
  'bookmarkedUserIds={socialState.bookmarkedUserIds}',
  'blockedUserIds={socialState.blockedUserIds}',
  'matchRequests={matchingState.matchRequests}',
  'activeMatch={matchingState.activeMatch}',
] as const;

const PHASE4_SPLIT_FILES = [
  'model/search/roommateSearchViewModel.ts',
  'sections/header/RoommateSearchHeader.tsx',
  'sections/scope-switcher/RoommateSearchControls.tsx',
  'sections/results/RoommateSearchResultsSection.tsx',
  'sections/empty-states/RoommateSearchStateSection.tsx',
  'components/RoommateSummaryCard.tsx',
] as const;

const PHASE5_SPLIT_FILES = [
  'model/filters/roommateFilterSheetModel.ts',
  'sections/filters/RoommateSearchFilterBar.tsx',
  'overlays/RoommateFilterSheet.tsx',
  'api/roommateActions.client.ts',
  'hooks/useRoommateBookmarkList.ts',
  'sections/bookmarks/RoommateBookmarkResultsSection.tsx',
] as const;

const PHASE7_SPLIT_FILES = [
  'api/roommateProfileDetail.client.ts',
  'hooks/useRoommateProfileDetail.ts',
  'overlays/RoommateProfileDetailDialog.tsx',
  'components/CompatibilityRadar.tsx',
  'components/CompatibilityAxisList.tsx',
  'model/compatibility/compatibilityChart.mapper.ts',
  'model/compatibility/compatibilityCopy.ts',
  'model/compatibility/compatibilityPrivacy.policy.ts',
] as const;

const FORBIDDEN_PHASE4_SHELL_INTERNALS = [
  'RoommateSearchSummary',
  'function renderSearchBody',
  'function RoommateSummaryCard',
  'function SummaryFact',
  'function NoticeList',
  'function lifestyleLabel',
] as const;

const FORBIDDEN_PHASE4_CARD_SOURCE_PATTERNS = [
  '@repo/shared/roommate-search/contract',
  'RoommateSearchSummary',
  'detailEntryToken',
] as const;

function listRuntimeSourceFiles(root: string): string[] {
  const stats = statSync(root, { throwIfNoEntry: false });
  if (!stats) return [];

  if (!stats.isDirectory()) {
    return isRuntimeSourceFile(root) ? [root] : [];
  }

  return readdirSync(root).flatMap((entry) => {
    const absolutePath = join(root, entry);
    const entryStats = statSync(absolutePath);

    if (entryStats.isDirectory()) {
      if (entry === '__tests__' || entry === '__stories__') return [];
      return listRuntimeSourceFiles(absolutePath);
    }

    return isRuntimeSourceFile(absolutePath) ? [absolutePath] : [];
  });
}

function isRuntimeSourceFile(path: string): boolean {
  return (
    /\.(ts|tsx)$/.test(path) &&
    !path.endsWith('.test.ts') &&
    !path.endsWith('.test.tsx') &&
    !path.endsWith('.stories.ts') &&
    !path.endsWith('.stories.tsx')
  );
}

describe('RoommateTab runtime boundary', () => {
  it('eventual production RoommateTab source does not use legacy mock/profile/local truth', () => {
    const violations = listRuntimeSourceFiles(roommateRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return FORBIDDEN_ROOMMATE_RUNTIME_PATTERNS.filter((pattern) => source.includes(pattern)).map(
        (pattern) => `${file}: ${pattern}`,
      );
    });

    expect(violations).toEqual([]);
  });

  it('eventual Main list branch does not pass legacy list props or require legacy bootstrap', () => {
    const source = readFileSync(mainRuntimeSource, 'utf8');
    const violations = FORBIDDEN_MAIN_LIST_BRIDGE_PATTERNS.filter((pattern) =>
      source.includes(pattern),
    ).map((pattern) => `${mainRuntimeSource}: ${pattern}`);

    expect(violations).toEqual([]);
  });

  it('Phase 4 shell keeps state/card rendering behind split components and mapper', () => {
    const missingFiles = PHASE4_SPLIT_FILES.map((file) => join(roommateRoot, file)).filter(
      (file) => !existsSync(file),
    );
    const source = readFileSync(join(roommateRoot, 'RoommateListTab.tsx'), 'utf8');
    const violations = FORBIDDEN_PHASE4_SHELL_INTERNALS.filter((pattern) =>
      source.includes(pattern),
    );

    expect(missingFiles).toEqual([]);
    expect(violations).toEqual([]);
  });

  it('Phase 4 card renders only the card view model and never raw search contract/token fields', () => {
    const source = readFileSync(join(roommateRoot, 'components/RoommateSummaryCard.tsx'), 'utf8');
    const violations = FORBIDDEN_PHASE4_CARD_SOURCE_PATTERNS.filter((pattern) =>
      source.includes(pattern),
    );

    expect(violations).toEqual([]);
  });

  it('Phase 5 keeps filter sheet and bookmark mode behind owner-specific files', () => {
    const missingFiles = PHASE5_SPLIT_FILES.map((file) => join(roommateRoot, file)).filter(
      (file) => !existsSync(file),
    );
    const actionClientSource = readFileSync(
      join(roommateRoot, 'api/roommateActions.client.ts'),
      'utf8',
    );
    const bookmarkHookSource = readFileSync(
      join(roommateRoot, 'hooks/useRoommateBookmarkList.ts'),
      'utf8',
    );

    expect(missingFiles).toEqual([]);
    expect(actionClientSource).toContain('/api/bookmarks');
    expect(actionClientSource).toContain('bookmarkListResponseSchema');
    expect(bookmarkHookSource).toContain('getRoommateBookmarkList');
  });

  it('Phase 7 keeps profile detail and compatibility UI behind RoommateTab owner files', () => {
    const missingFiles = PHASE7_SPLIT_FILES.map((file) => join(roommateRoot, file)).filter(
      (file) => !existsSync(file),
    );
    const detailClientSource = readFileSync(
      join(roommateRoot, 'api/roommateProfileDetail.client.ts'),
      'utf8',
    );
    const compatibilityMapperSource = readFileSync(
      join(roommateRoot, 'model/compatibility/compatibilityChart.mapper.ts'),
      'utf8',
    );

    expect(missingFiles).toEqual([]);
    expect(detailClientSource).toContain('/api/profiles/');
    expect(detailClientSource).toContain('publicProfileSchema');
    expect(compatibilityMapperSource).toContain('PublicProfileCompatibility');
  });
});
