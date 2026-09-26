import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MAIN_ROUTE_SHELL_SOURCE = resolve(process.cwd(), 'src/app/main/MainRouteShell.client.tsx');

function readMainRouteShellSource() {
  return readFileSync(MAIN_ROUTE_SHELL_SOURCE, 'utf8');
}

describe('Main Home first-render boundary', () => {
  it('MainRouteShell consumes the server auth/dashboard bootstrap without a legacy client gate', () => {
    const source = readMainRouteShellSource();

    expect(source).toContain('MainLayoutBootstrap');
    expect(source).not.toContain('useAuthSession');
    expect(source).not.toContain('@/main/hooks/useMainBootstrap');
    expect(source).not.toContain('useMainBootstrap');
    expect(source).not.toContain('mainBootstrap');
  });

  it('MainRouteShell does not require a legacy UserProfile before Home can start rendering', () => {
    const source = readMainRouteShellSource();

    expect(source).toContain('initialDashboard=');
    expect(source).not.toContain('initialUser=');
    expect(source).not.toContain('<MainBootstrapErrorState');
    expect(source).not.toContain('프로필 정보를 확인하지 못했어요');
  });
});
