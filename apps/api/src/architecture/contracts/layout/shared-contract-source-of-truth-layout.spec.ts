import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

type PackageExportTarget = { types: string; default: string };
type PackageJson = { exports: Record<string, PackageExportTarget | undefined> };

const EXCLUDED_API_DOMAIN_SEGMENTS = new Set([
  'retention',
  'matches',
  'config',
  'health',
  'profiles',
]);

const REMOVED_COMPAT_EXPORTS = [
  './auth-contract',
  './auth-policy',
  './auth-response',
  './chat-contract',
  './dormitory-contract',
  './season-contract',
  './session-contract',
] as const;

const REMOVED_ROOT_STYLE_ALIAS_EXPORTS = [
  './chat-realtime-contract',
  './chat-realtime-events',
  './notification-contract',
  './support-contract',
  './campus-contract',
  './college-contract',
  './date-primitives',
  './identity-contract',
] as const;

const CANONICAL_NESTED_EXPORTS: Record<string, PackageExportTarget> = {
  './auth': { types: './dist/auth/index.d.ts', default: './dist/auth/index.js' },
  './auth/contract': {
    types: './dist/auth/contract/index.d.ts',
    default: './dist/auth/contract/index.js',
  },
  './auth/policy': {
    types: './dist/auth/policy/index.d.ts',
    default: './dist/auth/policy/index.js',
  },
  './auth/response': {
    types: './dist/auth/response/index.d.ts',
    default: './dist/auth/response/index.js',
  },
  './auth/session': {
    types: './dist/auth/session/index.d.ts',
    default: './dist/auth/session/index.js',
  },
  './chat': { types: './dist/chat/index.d.ts', default: './dist/chat/index.js' },
  './chat/realtime-contract': {
    types: './dist/chat/realtime-contract.d.ts',
    default: './dist/chat/realtime-contract.js',
  },
  './chat/realtime-events': {
    types: './dist/chat/realtime-events.d.ts',
    default: './dist/chat/realtime-events.js',
  },
  './dormitory': { types: './dist/dormitory/index.d.ts', default: './dist/dormitory/index.js' },
  './dormitory/catalog': {
    types: './dist/dormitory/catalog.d.ts',
    default: './dist/dormitory/catalog.js',
  },
  './dormitory/enums': {
    types: './dist/dormitory/enums.d.ts',
    default: './dist/dormitory/enums.js',
  },
  './dormitory/guide': {
    types: './dist/dormitory/guide.d.ts',
    default: './dist/dormitory/guide.js',
  },
  './notifications': {
    types: './dist/notifications/index.d.ts',
    default: './dist/notifications/index.js',
  },
  './notifications/contract': {
    types: './dist/notifications/contract.d.ts',
    default: './dist/notifications/contract.js',
  },
  './season': { types: './dist/season/index.d.ts', default: './dist/season/index.js' },
  './season/operations': {
    types: './dist/season/operations/index.d.ts',
    default: './dist/season/operations/index.js',
  },
  './season/participation': {
    types: './dist/season/participation/index.d.ts',
    default: './dist/season/participation/index.js',
  },
  './season/primitives': {
    types: './dist/season/runtime/primitives.d.ts',
    default: './dist/season/runtime/primitives.js',
  },
  './season/response': {
    types: './dist/season/runtime/response.d.ts',
    default: './dist/season/runtime/response.js',
  },
  './season/runtime': {
    types: './dist/season/runtime/index.d.ts',
    default: './dist/season/runtime/index.js',
  },
  './support': { types: './dist/support/index.d.ts', default: './dist/support/index.js' },
  './support/contract': {
    types: './dist/support/contract.d.ts',
    default: './dist/support/contract.js',
  },
  './campus': { types: './dist/campus/index.d.ts', default: './dist/campus/index.js' },
  './college': { types: './dist/college/index.d.ts', default: './dist/college/index.js' },
  './date': { types: './dist/date/index.d.ts', default: './dist/date/index.js' },
  './identity': { types: './dist/identity/index.d.ts', default: './dist/identity/index.js' },
  './identity/primitives': {
    types: './dist/identity/primitives.d.ts',
    default: './dist/identity/primitives.js',
  },
  './lifestyle': { types: './dist/lifestyle/index.d.ts', default: './dist/lifestyle/index.js' },
};

const EXCLUDED_OWNER_ROOT_FILES = [
  'match-contract-enums.ts',
  'match-contract-history.ts',
  'match-contract-request.ts',
  'match-contract-response.ts',
  'match-contract-summary.ts',
  'match-contract.ts',
  'match-score.ts',
  'profile-contract-fields.ts',
  'profile-contract-public.ts',
  'profile-contract.ts',
  'roommate-search-contract.ts',
] as const;

const REMOVED_PUBLIC_SPECIFIERS = [
  '@repo/shared/auth-contract',
  '@repo/shared/auth-policy',
  '@repo/shared/auth-response',
  '@repo/shared/chat-contract',
  '@repo/shared/chat-realtime-contract',
  '@repo/shared/chat-realtime-events',
  '@repo/shared/dormitory-contract',
  '@repo/shared/notification-contract',
  '@repo/shared/season-contract',
  '@repo/shared/session-contract',
  '@repo/shared/support-contract',
  '@repo/shared/campus-contract',
  '@repo/shared/college-contract',
  '@repo/shared/date-primitives',
  '@repo/shared/identity-contract',
] as const;

function findRepoRoot() {
  let current = process.cwd();

  while (!existsSync(join(current, 'packages/shared/src'))) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('repo root with packages/shared/src not found');
    }
    current = parent;
  }

  return current;
}

function walkTypeScriptFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return walkTypeScriptFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

function repoRelativePath(path: string) {
  return relative(repoRoot, path).split(sep).join('/');
}

function readPackageJson() {
  return JSON.parse(
    readFileSync(join(repoRoot, 'packages/shared/package.json'), 'utf8'),
  ) as PackageJson;
}

function exportTargetIncludesCompat(target: PackageExportTarget | undefined) {
  return Boolean(target?.default.includes('/compat/') || target?.types.includes('/compat/'));
}

function isIncludedApiSource(path: string) {
  const relativeToApiSrc = relative(apiSrc, path).split(sep);
  return !relativeToApiSrc.some((segment) => EXCLUDED_API_DOMAIN_SEGMENTS.has(segment));
}

const repoRoot = findRepoRoot();
const sharedSrc = join(repoRoot, 'packages/shared/src');
const compatSrc = join(sharedSrc, 'compat');
const apiSrc = join(repoRoot, 'apps/api/src');
const apiTest = join(repoRoot, 'apps/api/test');
const webSrc = join(repoRoot, 'apps/web/src');
const ignoredSelf =
  'apps/api/src/architecture/contracts/layout/shared-contract-source-of-truth-layout.spec.ts';

describe('shared contract source-of-truth layout', () => {
  it('removes dist/compat public exports after canonical nested migration', () => {
    const sharedPackageJson = readPackageJson();

    const compatExports = Object.entries(sharedPackageJson.exports)
      .filter(([, target]) => exportTargetIncludesCompat(target))
      .map(([publicPath]) => publicPath)
      .sort();

    expect(compatExports).toEqual([]);
    for (const publicPath of REMOVED_COMPAT_EXPORTS) {
      expect(sharedPackageJson.exports[publicPath]).toBeUndefined();
    }
  });

  it('removes compat source files after canonical nested migration', () => {
    const compatFiles = existsSync(compatSrc)
      ? readdirSync(compatSrc, { withFileTypes: true })
          .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
          .map((entry) => entry.name)
          .sort()
      : [];

    expect(compatFiles).toEqual([]);
  });

  it('removes root-style public alias exports when canonical nested exports exist', () => {
    const sharedPackageJson = readPackageJson();

    for (const [publicPath, expectedTarget] of Object.entries(CANONICAL_NESTED_EXPORTS)) {
      expect(sharedPackageJson.exports[publicPath]).toEqual(expectedTarget);
    }

    for (const publicPath of REMOVED_ROOT_STYLE_ALIAS_EXPORTS) {
      expect(sharedPackageJson.exports[publicPath]).toBeUndefined();
    }
  });

  it('keeps root shared files limited to excluded owner files after neutral nested migration', () => {
    const rootTypeScriptFiles = readdirSync(sharedSrc, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
      .map((entry) => entry.name)
      .sort();

    expect(rootTypeScriptFiles).toEqual([...EXCLUDED_OWNER_ROOT_FILES].sort());
  });

  it('keeps included API/Web/shared source free of removed shared public paths', () => {
    const sourceRoots = [apiSrc, apiTest, webSrc, sharedSrc];
    const removedImportOffenders = sourceRoots
      .flatMap(walkTypeScriptFiles)
      .filter((path) => repoRelativePath(path) !== ignoredSelf)
      .filter((path) => !path.startsWith(apiSrc) || isIncludedApiSource(path))
      .flatMap((path) => {
        const source = readFileSync(path, 'utf8');
        const specifiers = REMOVED_PUBLIC_SPECIFIERS.filter((specifier) =>
          source.includes(specifier),
        );

        return specifiers.length > 0
          ? [{ path: repoRelativePath(path), specifiers: [...specifiers].sort() }]
          : [];
      })
      .sort((a, b) => a.path.localeCompare(b.path));

    expect(removedImportOffenders).toEqual([]);
  });
});
