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

const finalRemovedPaths = [
  ...phase1RemovedPaths,
  ...phase2RemovedPaths,
  ...phase3RemovedPaths,
  ...phase31RemovedPaths,
  ...phase4RemovedFlowPaths,
  'components/auth',
] as const;

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
  'app/api/auth/change-password/route.ts',
  'app/api/auth/dev-users/route.ts',
  'app/api/auth/login/route.ts',
  'app/api/auth/logout/route.ts',
  'app/api/auth/renew-session/route.ts',
  'app/api/auth/reset-password/route.ts',
  'app/api/auth/send-reset-code/route.ts',
  'app/api/auth/send-signup-code/route.ts',
  'app/api/auth/session/route.ts',
  'app/api/auth/signup/route.ts',
  'app/api/auth/validate-signup-draft/route.ts',
  'app/api/auth/verify-email-code/route.ts',
  'app/api/auth/verify-reset-code/route.ts',
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

const rootCompatibilityBarrelRules = [
  {
    path: 'hooks/index.ts',
    forbiddenSymbols: ['useCurrentUser', 'useRedirectIfAuthenticated', 'useCountdown'],
  },
  {
    path: 'constants/index.ts',
    forbiddenSymbols: [
      'LOGIN_LOCKOUT_SECONDS',
      'PASSWORD_MIN_LENGTH',
      'PASSWORD_MAX_LENGTH',
      'SIGNUP_VERIFICATION_CODE_TTL',
      'RESET_PASSWORD_VERIFICATION_CODE_TTL',
      'CAMPUS_OPTIONS',
    ],
  },
] as const;

const appRouterFlowPageImports = [
  {
    sourcePath: 'app/login/page.tsx',
    importPath: '@/auth/flows/login/LoginPageClient',
  },
  {
    sourcePath: 'app/signup/page.tsx',
    importPath: '@/auth/flows/signup/SignupPageClient',
  },
  {
    sourcePath: 'app/password-reset/page.tsx',
    importPath: '@/auth/flows/password-reset/PasswordResetPageClient',
  },
] as const;

const importStatementPatterns = [
  /\bimport\s+(?:type\s+)?(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:type\s+)?[^'";]*?\s+from\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
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

function toRelativeSourcePath(sourcePath: string): string {
  return sourcePath.replace(`${webSrc}/`, '');
}

function getImportSpecifiers(source: string): string[] {
  return importStatementPatterns.flatMap((pattern) =>
    Array.from(source.matchAll(pattern), (match) => match[1]).filter(
      (importPath): importPath is string => importPath !== undefined,
    ),
  );
}

function getSourceFileImports(sourcePath: string): string[] {
  return getImportSpecifiers(readFileSync(sourcePath, 'utf8'));
}

function isFinalForbiddenImport(importPath: string): boolean {
  return finalForbiddenImportPatterns.some(
    (forbiddenPath) => importPath === forbiddenPath || importPath.startsWith(`${forbiddenPath}/`),
  );
}

function isAuthBoundarySource(relativePath: string): boolean {
  return relativePath.startsWith('auth/');
}

function isAppAuthRouteAdapter(relativePath: string): boolean {
  return relativePath.startsWith('app/api/auth/') && relativePath.endsWith('/route.ts');
}

function isAllowedAppRouterFlowPageImport(relativePath: string, importPath: string): boolean {
  return appRouterFlowPageImports.some(
    (allowedImport) =>
      allowedImport.sourcePath === relativePath && allowedImport.importPath === importPath,
  );
}

function isAuthFlowImport(importPath: string): boolean {
  return importPath.startsWith('@/auth/flows/');
}

function isAuthFlowPrivateImport(importPath: string): boolean {
  return /^@\/auth\/flows\/[^/]+\/(?:components|hooks|model)(?:\/|$)/.test(importPath);
}

function isAuthBffImport(importPath: string): boolean {
  return importPath === '@/auth/bff' || importPath.startsWith('@/auth/bff/');
}

function isForbiddenPrivateAuthImport(relativePath: string, importPath: string): boolean {
  if (isAuthBoundarySource(relativePath)) {
    return false;
  }

  if (isAuthBffImport(importPath)) {
    return !isAppAuthRouteAdapter(relativePath);
  }

  if (isAuthFlowPrivateImport(importPath)) {
    return true;
  }

  if (isAuthFlowImport(importPath)) {
    return !isAllowedAppRouterFlowPageImport(relativePath, importPath);
  }

  return false;
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
    expect(readme).toContain('Strict final guard');
  });

  it('keeps all removed compatibility files, directories, and root barrel exports absent', () => {
    for (const relativePath of finalRemovedPaths) {
      expect(pathExists(relativePath), `${relativePath} should stay removed after Phase 5`).toBe(
        false,
      );
    }

    for (const barrelRule of rootCompatibilityBarrelRules) {
      const source = readFileSync(join(webSrc, barrelRule.path), 'utf8');

      for (const forbiddenSymbol of barrelRule.forbiddenSymbols) {
        expect(source, `${barrelRule.path} should not re-export ${forbiddenSymbol}`).not.toContain(
          forbiddenSymbol,
        );
      }
    }
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
      .map(toRelativeSourcePath);

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
      .map(toRelativeSourcePath);

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
      .map(toRelativeSourcePath);

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
      .map(toRelativeSourcePath);

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
      .map(toRelativeSourcePath);

    expect(filesWithProfileOwnedSource).toEqual([]);
  });

  it('strictly rejects final forbidden compatibility imports in source files', () => {
    const filesWithFinalForbiddenImports = listSourceFiles(webSrc)
      .filter((sourcePath) => sourcePath !== boundaryTestPath)
      .map((sourcePath) => ({
        sourcePath: toRelativeSourcePath(sourcePath),
        imports: getSourceFileImports(sourcePath).filter(isFinalForbiddenImport),
      }))
      .filter((sourceFile) => sourceFile.imports.length > 0);

    expect(filesWithFinalForbiddenImports).toEqual([]);
  });

  it('blocks non-auth deep imports of private auth BFF and flow internals', () => {
    const filesWithForbiddenPrivateImports = listSourceFiles(webSrc)
      .filter((sourcePath) => sourcePath !== boundaryTestPath)
      .map((sourcePath) => {
        const relativePath = toRelativeSourcePath(sourcePath);

        return {
          sourcePath: relativePath,
          imports: getSourceFileImports(sourcePath).filter((importPath) =>
            isForbiddenPrivateAuthImport(relativePath, importPath),
          ),
        };
      })
      .filter((sourceFile) => sourceFile.imports.length > 0);

    expect(filesWithForbiddenPrivateImports).toEqual([]);
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
