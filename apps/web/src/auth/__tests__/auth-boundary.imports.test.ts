import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webSrc = join(process.cwd(), 'src');
const readmePath = join(webSrc, 'auth', 'README.md');

const currentLegacyPaths = [
  'api/auth.ts',
  'app/api/auth/_shared.ts',
  'app/api/auth/_post-route.ts',
  'app/api/auth/_request-guard.ts',
  'components/AuthHeader.tsx',
  'components/auth/PasswordRequirementList.tsx',
  'constants/auth.ts',
  'hooks/useCurrentUser.ts',
  'hooks/useRedirectIfAuthenticated.ts',
  'hooks/useCountdown.ts',
  'login',
  'signup',
  'password-reset',
] as const;

const appRouterEntrypoints = [
  'app/api/auth/login/route.ts',
  'app/api/auth/signup/route.ts',
  'app/api/auth/session/route.ts',
  'app/api/auth/logout/route.ts',
  'app/api/auth/send-signup-code/route.ts',
  'app/api/auth/verify-email-code/route.ts',
  'app/api/auth/send-reset-code/route.ts',
  'app/api/auth/verify-reset-code/route.ts',
  'app/api/auth/reset-password/route.ts',
  'app/login/page.tsx',
  'app/signup/page.tsx',
  'app/password-reset/page.tsx',
] as const;

const finalForbiddenImportPatterns = [
  '@/api/auth',
  '@/constants/auth',
  '@/components/AuthHeader',
  '@/components/auth',
  '@/hooks/useCurrentUser',
  '@/hooks/useRedirectIfAuthenticated',
  '@/hooks/useCountdown',
  '@/login',
  '@/signup',
  '@/password-reset',
] as const;

function pathExists(relativePath: string): boolean {
  return existsSync(join(webSrc, relativePath));
}

function readAuthReadme(): string {
  return readFileSync(readmePath, 'utf8');
}

describe('web auth boundary migration ledger', () => {
  it('auth README documents final ownership, target structure, and migration rules', () => {
    expect(existsSync(readmePath)).toBe(true);

    const readme = readAuthReadme();

    expect(readme).toContain('Web Auth Boundary');
    expect(readme).toContain('auth/api');
    expect(readme).toContain('auth/bff');
    expect(readme).toContain('auth/components');
    expect(readme).toContain('auth/hooks');
    expect(readme).toContain('auth/model');
    expect(readme).toContain('auth/flows/login');
    expect(readme).toContain('auth/flows/signup');
    expect(readme).toContain('auth/flows/password-reset');
    expect(readme).toContain('App Router exception');
    expect(readme).toContain('No compatibility re-export target');
    expect(readme).toContain('@/auth/api');
  });

  it('tracks current legacy auth paths that later phases intentionally remove', () => {
    expect(pathExists('auth/to-user-profile.ts')).toBe(true);

    for (const relativePath of currentLegacyPaths) {
      expect(
        pathExists(relativePath),
        `${relativePath} should be tracked as a Phase 0 legacy path`,
      ).toBe(true);
    }
  });

  it('keeps final forbidden import patterns discoverable without enforcing them in Phase 0', () => {
    expect(finalForbiddenImportPatterns).toContain('@/api/auth');
    expect(finalForbiddenImportPatterns).toContain('@/constants/auth');
    expect(finalForbiddenImportPatterns).toContain('@/components/AuthHeader');
    expect(finalForbiddenImportPatterns).toContain('@/components/auth');
    expect(finalForbiddenImportPatterns).toContain('@/login');
    expect(finalForbiddenImportPatterns).toContain('@/signup');
    expect(finalForbiddenImportPatterns).toContain('@/password-reset');

    const readme = readAuthReadme();

    for (const importPattern of finalForbiddenImportPatterns) {
      expect(readme).toContain(importPattern);
    }
  });

  it('keeps framework entrypoints under app while documenting them as thin adapters', () => {
    for (const relativePath of appRouterEntrypoints) {
      expect(
        pathExists(relativePath),
        `${relativePath} should remain an App Router entrypoint`,
      ).toBe(true);
    }

    const readme = readAuthReadme();

    expect(readme).toContain('app/api/auth/<route>/route.ts');
    expect(readme).toContain('app/login/page.tsx');
    expect(readme).toContain('app/signup/page.tsx');
    expect(readme).toContain('app/password-reset/page.tsx');
    expect(readme).toContain('thin');
  });
});
