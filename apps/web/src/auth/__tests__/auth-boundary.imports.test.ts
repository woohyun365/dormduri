import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webSrc = join(process.cwd(), 'src');
const readmePath = join(webSrc, 'auth', 'README.md');
const boundaryTestPath = join(webSrc, 'auth', '__tests__', 'auth-boundary.imports.test.ts');

const phase4RemovedFlowPaths = ['login', 'signup', 'password-reset'] as const;

const phase1RemovedPaths = ['api/auth.ts'] as const;

const phase2RemovedPaths = [
  'app/api/auth/_shared.ts',
  'app/api/auth/_post-route.ts',
  'app/api/auth/_request-guard.ts',
] as const;

const phase3RemovedPaths = [
  'components/AuthHeader.tsx',
  'components/auth/PasswordRequirementList.tsx',
  'constants/auth.ts',
  'hooks/useCurrentUser.ts',
  'hooks/useRedirectIfAuthenticated.ts',
  'hooks/useCountdown.ts',
] as const;

const phase31RemovedPaths = ['auth/to-user-profile.ts', 'auth/hooks/useCurrentUser.ts'] as const;

const phase31ForbiddenAuthSourcePatterns = [
  '@/types/profile',
  '@/types/lifestyle',
  'UserProfile',
  'toUserProfile',
  'to-user-profile',
] as const;

const authSharedEntrypoints = [
  'auth/components/index.ts',
  'auth/components/AuthHeader.tsx',
  'auth/components/PasswordRequirementList.tsx',
  'auth/components/__tests__/PasswordRequirementList.test.tsx',
  'auth/hooks/index.ts',
  'auth/hooks/useAuthSession.ts',
  'auth/hooks/useRedirectIfAuthenticated.ts',
  'auth/hooks/useAuthCountdown.ts',
  'auth/hooks/__tests__/useRedirectIfAuthenticated.test.ts',
  'auth/model/index.ts',
  'auth/model/policy-constants.ts',
  'auth/flows/signup/model/campus-options.ts',
] as const;

const authFlowEntrypoints = [
  'auth/flows/login/LoginPageClient.tsx',
  'auth/flows/login/README.md',
  'auth/flows/login/components/LoginForm.tsx',
  'auth/flows/login/hooks/useLoginForm.ts',
  'auth/flows/login/model/login-form.validation.ts',
  'auth/flows/signup/SignupPageClient.tsx',
  'auth/flows/signup/README.md',
  'auth/flows/signup/components/AccountIdentityStep.tsx',
  'auth/flows/signup/components/LegalConsentStep.tsx',
  'auth/flows/signup/components/email-verification/StepEmailVerification.tsx',
  'auth/flows/signup/hooks/useSignupDraftStorage.ts',
  'auth/flows/signup/model/campus-options.ts',
  'auth/flows/signup/model/signup-request.mapper.ts',
  'auth/flows/password-reset/PasswordResetPageClient.tsx',
  'auth/flows/password-reset/README.md',
  'auth/flows/password-reset/components/PasswordResetEmailStep.tsx',
  'auth/flows/password-reset/hooks/usePasswordResetFlow.ts',
  'auth/flows/password-reset/model/password-reset-flow.reducer.ts',
] as const;

const phase3ForbiddenImportPatterns = [
  '@/constants/auth',
  '@/components/AuthHeader',
  '@/components/auth',
  '@/hooks/useCurrentUser',
  '@/hooks/useRedirectIfAuthenticated',
  '@/hooks/useCountdown',
] as const;

const authBffEntrypoints = [
  'auth/bff/index.ts',
  'auth/bff/auth-forward.ts',
  'auth/bff/auth-response.ts',
  'auth/bff/auth-cookies.ts',
  'auth/bff/auth-request-guard.ts',
  'auth/bff/auth-route-handlers.ts',
  'auth/bff/__tests__/auth-forward-response.test.ts',
  'auth/bff/__tests__/auth-route-handlers.test.ts',
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

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(absolutePath);
    }

    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) {
      return [];
    }

    return [absolutePath];
  });
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

  it('keeps Phase 4 auth flow directory move complete without root compatibility paths', () => {
    for (const relativePath of phase4RemovedFlowPaths) {
      expect(pathExists(relativePath), `${relativePath} should be removed after Phase 4`).toBe(
        false,
      );
    }

    for (const relativePath of authFlowEntrypoints) {
      expect(pathExists(relativePath), `${relativePath} should exist after Phase 4`).toBe(true);
    }

    const filesWithOldFlowImports = listSourceFiles(webSrc)
      .filter((sourcePath) => sourcePath !== boundaryTestPath)
      .filter((sourcePath) => {
        const source = readFileSync(sourcePath, 'utf8');
        return /(?:from|import)\s*\(?['"]@\/(?:login|signup|password-reset)(?:\/|['"])/.test(
          source,
        );
      })
      .map((sourcePath) => sourcePath.replace(`${webSrc}/`, ''));

    expect(filesWithOldFlowImports).toEqual([]);
  });

  it('keeps Phase 1 auth API client migration complete without compatibility re-export', () => {
    for (const relativePath of phase1RemovedPaths) {
      expect(pathExists(relativePath), `${relativePath} should be removed after Phase 1`).toBe(
        false,
      );
    }

    expect(pathExists('auth/api/index.ts')).toBe(true);
    expect(pathExists('auth/api/client.ts')).toBe(true);
    expect(pathExists('auth/api/__tests__/auth-api.client.test.ts')).toBe(true);

    const filesWithOldAuthImport = listSourceFiles(webSrc)
      .filter((sourcePath) => sourcePath !== boundaryTestPath)
      .filter((sourcePath) => readFileSync(sourcePath, 'utf8').includes('@/api/auth'))
      .map((sourcePath) => sourcePath.replace(`${webSrc}/`, ''));

    expect(filesWithOldAuthImport).toEqual([]);
  });

  it('keeps Phase 2 auth BFF helper migration complete without app route helper files', () => {
    for (const relativePath of phase2RemovedPaths) {
      expect(pathExists(relativePath), `${relativePath} should be removed after Phase 2`).toBe(
        false,
      );
    }

    for (const relativePath of authBffEntrypoints) {
      expect(pathExists(relativePath), `${relativePath} should exist after Phase 2`).toBe(true);
    }

    const filesWithOldBffHelperImports = listSourceFiles(join(webSrc, 'app', 'api', 'auth'))
      .filter((sourcePath) =>
        readFileSync(sourcePath, 'utf8').match(
          /\.\.\/_shared|\.\.\/_post-route|\.\.\/_request-guard|\.\/_shared/,
        ),
      )
      .map((sourcePath) => sourcePath.replace(`${webSrc}/`, ''));

    expect(filesWithOldBffHelperImports).toEqual([]);
  });

  it('keeps Phase 3 auth shared UI/hook/model migration complete without compatibility re-export', () => {
    for (const relativePath of phase3RemovedPaths) {
      expect(pathExists(relativePath), `${relativePath} should be removed after Phase 3`).toBe(
        false,
      );
    }

    for (const relativePath of authSharedEntrypoints) {
      expect(pathExists(relativePath), `${relativePath} should exist after Phase 3`).toBe(true);
    }

    const filesWithOldAuthSharedImports = listSourceFiles(webSrc)
      .filter((sourcePath) => sourcePath !== boundaryTestPath)
      .filter((sourcePath) => {
        const source = readFileSync(sourcePath, 'utf8');
        return phase3ForbiddenImportPatterns.some((importPattern) =>
          source.includes(importPattern),
        );
      })
      .map((sourcePath) => sourcePath.replace(`${webSrc}/`, ''));

    expect(filesWithOldAuthSharedImports).toEqual([]);
  });

  it('keeps Phase 3-1 auth session identity separated from profile/main view models', () => {
    for (const relativePath of phase31RemovedPaths) {
      expect(pathExists(relativePath), `${relativePath} should be removed after Phase 3-1`).toBe(
        false,
      );
    }

    expect(pathExists('auth/hooks/useAuthSession.ts')).toBe(true);

    const filesWithProfileOwnedSource = listSourceFiles(join(webSrc, 'auth'))
      .filter((sourcePath) => sourcePath !== boundaryTestPath)
      .filter((sourcePath) => {
        const source = readFileSync(sourcePath, 'utf8');
        return phase31ForbiddenAuthSourcePatterns.some((pattern) => source.includes(pattern));
      })
      .map((sourcePath) => sourcePath.replace(`${webSrc}/`, ''));

    expect(filesWithProfileOwnedSource).toEqual([]);
  });

  it('keeps final forbidden import patterns discoverable for Phase 5 strict guard', () => {
    expect(finalForbiddenImportPatterns).toContain('@/api/auth');
    expect(finalForbiddenImportPatterns).toContain('@/constants/auth');
    expect(finalForbiddenImportPatterns).toContain('@/components/AuthHeader');
    expect(finalForbiddenImportPatterns).toContain('@/components/auth');
    expect(finalForbiddenImportPatterns).toContain('@/hooks/useCurrentUser');
    expect(finalForbiddenImportPatterns).toContain('@/hooks/useRedirectIfAuthenticated');
    expect(finalForbiddenImportPatterns).toContain('@/hooks/useCountdown');
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

    expect(readFileSync(join(webSrc, 'app', 'login', 'page.tsx'), 'utf8')).toContain(
      '@/auth/flows/login/LoginPageClient',
    );
    expect(readFileSync(join(webSrc, 'app', 'signup', 'page.tsx'), 'utf8')).toContain(
      '@/auth/flows/signup/SignupPageClient',
    );
    expect(readFileSync(join(webSrc, 'app', 'password-reset', 'page.tsx'), 'utf8')).toContain(
      '@/auth/flows/password-reset/PasswordResetPageClient',
    );

    const readme = readAuthReadme();

    expect(readme).toContain('app/api/auth/<route>/route.ts');
    expect(readme).toContain('app/login/page.tsx');
    expect(readme).toContain('app/signup/page.tsx');
    expect(readme).toContain('app/password-reset/page.tsx');
    expect(readme).toContain('thin');
  });
});
