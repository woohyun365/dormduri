import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFileSync(path.join(process.cwd(), 'src', relative), 'utf8');

describe('main route boundary', () => {
  it('does not retain the superseded tab orchestrator, title effect or legacy bootstrap', () => {
    for (const file of [
      'main/Main.tsx',
      'main/hooks/useMainLegacyTabData.ts',
      'main/legacy/profileLegacyClient.ts',
      'main/legacy/seasonLegacyClient.ts',
      'main/season/seasonFallback.ts',
      'main/utils/mainTabTitle.ts',
    ])
      expect(existsSync(path.join(process.cwd(), 'src', file)), file).toBe(false);
    expect(read('main/components/BottomTabBar.tsx')).not.toContain('onTabChange');
  });

  it('server layout resolves the protected bootstrap before composing children without a tab registry', () => {
    const layout = read('app/main/layout.tsx');
    expect(layout).not.toContain("'use client'");
    expect(layout).toContain('await readMainLayoutBootstrap()');
    expect(layout).toContain('<MainRouteShell bootstrap={bootstrap}>{children}</MainRouteShell>');
    for (const file of ['app/main/MainRouteShell.client.tsx', 'main/runtime/MainRuntime.tsx']) {
      const source = read(file);
      expect(source).not.toMatch(/import .* from ['"].*(?:\/Main['"]|\/tabs\/.*Tab['"])/);
      expect(source).not.toContain('sessionStorage');
      expect(source).not.toContain('document.title');
    }
  });

  it('does not hide the protected primary aggregate behind a blanket loading boundary', () => {
    expect(existsSync(path.join(process.cwd(), 'src/app/main/loading.tsx'))).toBe(false);
    expect(existsSync(path.join(process.cwd(), 'src/app/main/error.tsx'))).toBe(true);
    expect(read('app/main/layout.tsx')).not.toContain('Suspense');
    expect(read('main/runtime/MainRuntime.tsx')).toContain('<AppShellSkeleton />');
  });

  it.each([
    ['', 'HomeRoute'],
    ['roommates/', 'RoommatesRoute'],
    ['matching/', 'MatchingRoute'],
    ['chat/', 'ChatRoute'],
    ['profile/', 'ProfileRoute'],
  ])('%s page owns its feature entry and metadata', (destination, entry) => {
    const source = read(`app/main/${destination}page.tsx`);
    expect(source).not.toContain("'use client'");
    expect(source).toContain(`/routes/${entry}`);
    expect(source).toContain('metadata');
    expect(source).not.toContain('MainRouteShell');
  });

  it('keeps token-free recovery and keys private runtime by the server-verified viewer', () => {
    const source = read('app/main/MainRouteShell.client.tsx');
    expect(source).not.toContain('useAuthSession');
    expect(source).toContain("bootstrap.status === 'session-recovery-required'");
    expect(source).toContain("router.replace('/login')");
    expect(source).toContain('key={bootstrap.viewerId}');
  });
});
