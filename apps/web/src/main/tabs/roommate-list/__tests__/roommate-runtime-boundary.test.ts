import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const roommateRoot = join(process.cwd(), 'src/main/tabs/roommate-list');
const mainRuntimeSource = join(process.cwd(), 'src/main/routes/RoommatesRoute.tsx');

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
  '@/main/components/BottomSheet',
  '@/types/filter',
  'targetCondition',
  'viewerValue',
  'targetValue',
  'matrixKey',
  'bookmarkedUserIds',
  'blockedUserIds',
  'displayCount',
  'localStorage',
  'sessionStorage',
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
    /\.(ts|tsx)$/u.test(path) &&
    !path.endsWith('.test.ts') &&
    !path.endsWith('.test.tsx') &&
    !path.endsWith('.stories.ts') &&
    !path.endsWith('.stories.tsx')
  );
}

describe('RoommateTab runtime boundary', () => {
  it('production source does not use mock profile data or local policy truth', () => {
    const violations = listRuntimeSourceFiles(roommateRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return FORBIDDEN_ROOMMATE_RUNTIME_PATTERNS.filter((pattern) => source.includes(pattern)).map(
        (pattern) => `${file}: ${pattern}`,
      );
    });

    expect(violations).toEqual([]);
  });

  it('Roommates route delegates roommate search state instead of passing legacy list props', () => {
    const source = readFileSync(mainRuntimeSource, 'utf8');
    const violations = FORBIDDEN_MAIN_LIST_BRIDGE_PATTERNS.filter((pattern) =>
      source.includes(pattern),
    ).map((pattern) => `${mainRuntimeSource}: ${pattern}`);

    expect(violations).toEqual([]);
  });

  it('keeps search shell rendering behind owner components and view models', () => {
    const source = readFileSync(join(roommateRoot, 'RoommateListTab.tsx'), 'utf8');

    expect(source).toContain('RoommateListControlsPanel');
    expect(source).toContain('RoommateSearchFeedback');
    expect(source).toContain('RoommateSearchResultsSection');
    expect(source).not.toContain('function RoommateSummaryCard');
    expect(source).not.toContain('function SummaryFact');
    expect(source).not.toContain('function getSearchStateSectionState');
  });

  it('summary cards consume display models instead of raw contracts or entry tokens', () => {
    const source = readFileSync(join(roommateRoot, 'components/RoommateSummaryCard.tsx'), 'utf8');

    expect(source).not.toContain('@repo/shared/roommate-search/contract');
    expect(source).not.toContain('RoommateSearchSummary');
    expect(source).not.toContain('detailEntryToken');
  });

  it('keeps profile detail and compatibility mapping behind owner clients and models', () => {
    const detailClientSource = readFileSync(
      join(roommateRoot, 'api/roommateProfileDetail.client.ts'),
      'utf8',
    );
    const compatibilityMapperSource = readFileSync(
      join(roommateRoot, 'model/compatibility/compatibilityChart.mapper.ts'),
      'utf8',
    );

    expect(detailClientSource).toContain('/api/profiles/');
    expect(detailClientSource).toContain('publicProfileSchema');
    expect(compatibilityMapperSource).toContain('PublicProfileCompatibility');
  });

  it('keeps bookmark, block, report, and match request I/O in the action client', () => {
    const actionClientSource = readFileSync(
      join(roommateRoot, 'api/roommateActions.client.ts'),
      'utf8',
    );
    const actionsHookSource = readFileSync(
      join(roommateRoot, 'hooks/useRoommateActions.ts'),
      'utf8',
    );

    expect(actionClientSource).toContain('/api/bookmarks');
    expect(actionClientSource).toContain('/api/blocks/');
    expect(actionClientSource).toContain('/api/reports');
    expect(actionClientSource).toContain('/api/matches/requests');
    expect(actionClientSource).toContain('bookmarkListResponseSchema');
    expect(actionsHookSource).toContain('pendingTargetUserIds');
    expect(actionsHookSource).not.toContain('detailEntryToken');
  });

  it('action receipts expose user-facing outcomes without status-code presentation', () => {
    const source = readFileSync(
      join(roommateRoot, 'overlays/RoommateActionReceiptDialog.tsx'),
      'utf8',
    );
    const feedbackSource = readFileSync(
      join(roommateRoot, 'components/search/RoommateSearchFeedback.tsx'),
      'utf8',
    );

    expect(source).toContain('counterpartNickname');
    expect(source).toContain('noticeSections');
    expect(source).not.toContain('이미 요청을 보낸 사용자');
    expect(feedbackSource).toContain("receipt?.actionKind === 'block'");
  });
});
