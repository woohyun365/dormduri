import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const homeRoot = join(process.cwd(), 'src/main/tabs/home');
const mainHomeFirstRenderSourceRoots = [
  join(process.cwd(), 'src/app/main/MainRouteShell.client.tsx'),
  join(process.cwd(), 'src/main/Main.tsx'),
  join(process.cwd(), 'src/main/hooks/useMainBootstrap.ts'),
  join(process.cwd(), 'src/main/hooks/useMainHomeDashboard.ts'),
  homeRoot,
] as const;

function importPath(...parts: string[]): string {
  return parts.join('');
}

const FORBIDDEN_RUNTIME_PATTERNS = [
  importPath('@', '/main/dev-only/fixtures'),
  importPath('src/', '__fixtures__'),
  importPath('main/', 'test-support'),
  importPath('@', '/api/profile'),
  importPath('@', '/api/home'),
  importPath('@', '/api/current-user'),
  importPath('@', '/api/season'),
  importPath('@', '/main/contexts/SeasonContext'),
  importPath('@', '/main/season/seasonFallback'),
  importPath('@', '/main/utils/homeDevOverrides'),
  'readHomeMatchingSummaryOverrides',
  '__stories__',
  '.stories',
] as const;
const FORBIDDEN_HOME_FIRST_RENDER_PATTERNS = [
  importPath('@', '/main/dev-only/fixtures'),
  importPath('src/', '__fixtures__'),
  importPath('@', '/api/profile'),
  importPath('@', '/api/home'),
  importPath('@', '/api/current-user'),
  importPath('@', '/api/season'),
  'profileApi',
  'getMyProfile',
  'getMockData',
  'mockDb',
  'useMainBootstrap',
] as const;
const HOME_SECTION_RUNTIME_ROOTS = [
  join(homeRoot, 'components'),
  join(homeRoot, 'layout'),
  join(homeRoot, 'sections'),
  join(homeRoot, 'overlays'),
  join(homeRoot, 'profile-modals'),
] as const;
const FORBIDDEN_SECTION_DIRECT_IO_PATTERNS = [
  { label: 'fetch(', pattern: /\bfetch\s*\(/ },
  { label: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { label: 'navigator.sendBeacon', pattern: /\bnavigator\s*\.\s*sendBeacon\s*\(/ },
] as const;
const REMOVED_ROOT_COMPATIBILITY_PATHS = [
  join(process.cwd(), 'src', '__fixtures__'),
  join(process.cwd(), 'src', 'api', 'home.ts'),
  join(process.cwd(), 'src', 'api', 'current-user.ts'),
  join(process.cwd(), 'src', 'api', 'season.ts'),
  join(process.cwd(), 'src', 'constants', 'season.ts'),
  join(process.cwd(), 'src', 'contexts', 'SeasonContext.tsx'),
  join(process.cwd(), 'src', 'hooks', 'useOnboardingState.ts'),
  join(process.cwd(), 'src', 'types', 'season.ts'),
  join(process.cwd(), 'src', 'utils', 'date.ts'),
] as const;

function listRuntimeSourceFiles(root: string): string[] {
  const stats = statSync(root, { throwIfNoEntry: false });
  if (!stats) return [];

  if (!stats.isDirectory()) {
    return /\.(ts|tsx)$/.test(root) && !root.endsWith('.test.ts') && !root.endsWith('.test.tsx')
      ? [root]
      : [];
  }

  return readdirSync(root).flatMap((entry) => {
    const absolutePath = join(root, entry);

    if (statSync(absolutePath).isDirectory()) {
      if (entry === '__tests__' || entry === '__stories__') return [];
      return listRuntimeSourceFiles(absolutePath);
    }

    return /\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')
      ? [absolutePath]
      : [];
  });
}

describe('Home runtime boundary', () => {
  it('production Home source does not import global fixtures, test support, or stories', () => {
    const violations = listRuntimeSourceFiles(homeRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return FORBIDDEN_RUNTIME_PATTERNS.filter((pattern) => source.includes(pattern)).map(
        (pattern) => `${file}: ${pattern}`,
      );
    });

    expect(violations).toEqual([]);
  });

  it('Home first-render runtime does not depend on legacy profile/mock bootstrap sources', () => {
    const violations = mainHomeFirstRenderSourceRoots
      .flatMap((root) => listRuntimeSourceFiles(root))
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return FORBIDDEN_HOME_FIRST_RENDER_PATTERNS.filter((pattern) =>
          source.includes(pattern),
        ).map((pattern) => `${file}: ${pattern}`);
      });

    expect(violations).toEqual([]);
  });

  it('Home section components do not perform browser or network I/O directly', () => {
    const violations = HOME_SECTION_RUNTIME_ROOTS.flatMap((root) =>
      listRuntimeSourceFiles(root),
    ).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return FORBIDDEN_SECTION_DIRECT_IO_PATTERNS.filter(({ pattern }) => pattern.test(source)).map(
        ({ label }) => `${file}: ${label}`,
      );
    });

    expect(violations).toEqual([]);
  });

  it('removed root compatibility files are not reintroduced as Home dependencies', () => {
    const reintroduced = REMOVED_ROOT_COMPATIBILITY_PATHS.filter(
      (path) => statSync(path, { throwIfNoEntry: false }) !== undefined,
    );

    expect(reintroduced).toEqual([]);
  });

  it('Home dashboard view model does not calculate readiness from legacy UserProfile lifestyle', () => {
    const source = readFileSync(join(homeRoot, 'model/homeDashboardViewModel.ts'), 'utf8');

    expect(source).not.toContain('UserProfile');
    expect(source).not.toContain('user.lifestyle');
    expect(source).not.toContain('isLifestyleRequiredComplete');
    expect(source).toContain('seasonProfile');
  });

  it('Home view model is derived from HomeDashboardResponse without raw season fallback inputs', () => {
    const source = readFileSync(join(homeRoot, 'model/homeDashboardViewModel.ts'), 'utf8');

    expect(source).toContain('dashboard.season.state');
    expect(source).not.toContain('SeasonContextValue');
    expect(source).not.toContain('calcSeasonDates');
    expect(source).not.toContain('matchingOverrides');
  });
});
