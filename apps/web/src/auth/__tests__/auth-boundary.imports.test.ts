import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webSrc = join(process.cwd(), 'src');
const readmePath = join(webSrc, 'auth', 'README.md');
const boundaryTestPath = join(webSrc, 'auth', '__tests__', 'auth-boundary.imports.test.ts');

const blockedCompatibilityPaths = [
  'api/auth.ts',
  'app/api/auth/_shared.ts',
  'app/api/auth/_post-route.ts',
  'app/api/auth/_request-guard.ts',
  'components/AuthHeader.tsx',
  'components/auth',
  'components/auth/PasswordRequirementList.tsx',
  'constants/auth.ts',
  'hooks/useCurrentUser.ts',
  'hooks/useRedirectIfAuthenticated.ts',
  'hooks/useCountdown.ts',
  'auth/to-user-profile.ts',
  'auth/hooks/useCurrentUser.ts',
  'login',
  'signup',
  'password-reset',
] as const;

const blockedCompatibilityImportPatterns = [
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

const blockedRootBarrelRules = [
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

const authOwnedProfileForbiddenPatterns = [
  '@/types/profile',
  '@/types/lifestyle',
  'UserProfile',
  'toUserProfile',
  'to-user-profile',
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

function isBlockedCompatibilityImport(importPath: string): boolean {
  return blockedCompatibilityImportPatterns.some(
    (blockedPath) => importPath === blockedPath || importPath.startsWith(`${blockedPath}/`),
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

describe('web auth final boundary guard', () => {
  it('documents final ownership, public/private imports, App Router exceptions, and close readiness', () => {
    expect(existsSync(readmePath)).toBe(true);

    const readme = readAuthReadme();

    expect(readme).toContain('Web Auth Boundary');
    expect(readme).toContain('Final directory contract');
    expect(readme).toContain('Ownership');
    expect(readme).toContain('Public/private import rule');
    expect(readme).toContain('App Router exception');
    expect(readme).toContain('Blocked compatibility surfaces');
    expect(readme).toContain('Close readiness and follow-ups');
    expect(readme).toContain('@/auth/api');
    expect(readme).toContain('without requiring a live API/DB');
    expect(readme).not.toContain('Phase migration map');
    expect(readme).not.toContain('Completed migration ledger');
  });

  it('keeps blocked compatibility files, directories, and root barrel exports absent', () => {
    for (const relativePath of blockedCompatibilityPaths) {
      expect(pathExists(relativePath), `${relativePath} should stay removed`).toBe(false);
    }

    for (const barrelRule of blockedRootBarrelRules) {
      const source = readFileSync(join(webSrc, barrelRule.path), 'utf8');

      for (const forbiddenSymbol of barrelRule.forbiddenSymbols) {
        expect(source, `${barrelRule.path} should not re-export ${forbiddenSymbol}`).not.toContain(
          forbiddenSymbol,
        );
      }
    }
  });

  it('rejects blocked compatibility imports in source files', () => {
    const filesWithBlockedCompatibilityImports = listSourceFiles(webSrc)
      .filter((sourcePath) => sourcePath !== boundaryTestPath)
      .map((sourcePath) => ({
        sourcePath: toRelativeSourcePath(sourcePath),
        imports: getSourceFileImports(sourcePath).filter(isBlockedCompatibilityImport),
      }))
      .filter((sourceFile) => sourceFile.imports.length > 0);

    expect(filesWithBlockedCompatibilityImports).toEqual([]);
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

  it('keeps auth session identity separated from profile/main view models', () => {
    expect(pathExists('auth/hooks/useAuthSession.ts')).toBe(true);

    const filesWithProfileOwnedSource = listSourceFiles(join(webSrc, 'auth'))
      .filter((sourcePath) => sourcePath !== boundaryTestPath)
      .filter((sourcePath) => {
        const source = readFileSync(sourcePath, 'utf8');
        return authOwnedProfileForbiddenPatterns.some((pattern) => source.includes(pattern));
      })
      .map(toRelativeSourcePath);

    expect(filesWithProfileOwnedSource).toEqual([]);
  });

  it('keeps framework entrypoints under app while documenting them as thin adapters', () => {
    for (const relativePath of appRouterEntrypoints) {
      expect(
        pathExists(relativePath),
        `${relativePath} should remain an App Router entrypoint`,
      ).toBe(true);
    }

    for (const allowedImport of appRouterFlowPageImports) {
      expect(readFileSync(join(webSrc, allowedImport.sourcePath), 'utf8')).toContain(
        allowedImport.importPath,
      );
    }

    const readme = readAuthReadme();

    expect(readme).toContain('app/api/auth/<route>/route.ts');
    expect(readme).toContain('app/login/page.tsx');
    expect(readme).toContain('app/signup/page.tsx');
    expect(readme).toContain('app/password-reset/page.tsx');
    expect(readme).toContain('thin');
  });
});
