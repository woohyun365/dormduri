import { readdirSync, readFileSync, statSync } from 'node:fs';
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
  'DEFAULT_FILTERS',
  'FilterState',
  'bookmarkedUserIds',
  'blockedUserIds',
  'displayCount',
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
});
