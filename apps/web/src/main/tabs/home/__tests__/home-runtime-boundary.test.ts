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
const FORBIDDEN_RUNTIME_PATTERNS = [
  '@/__fixtures__',
  'src/__fixtures__',
  'main/test-support',
  '__stories__',
  '.stories',
] as const;
const FORBIDDEN_HOME_FIRST_RENDER_PATTERNS = [
  '@/__fixtures__',
  'src/__fixtures__',
  '@/api/profile',
  'profileApi',
  'getMyProfile',
  'getMockData',
  'mockDb',
  'useMainBootstrap',
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

  it('Home dashboard view model does not calculate readiness from legacy UserProfile lifestyle', () => {
    const source = readFileSync(join(homeRoot, 'model/homeDashboardViewModel.ts'), 'utf8');

    expect(source).not.toContain('UserProfile');
    expect(source).not.toContain('user.lifestyle');
    expect(source).not.toContain('isLifestyleRequiredComplete');
    expect(source).toContain('seasonProfile');
  });
});
