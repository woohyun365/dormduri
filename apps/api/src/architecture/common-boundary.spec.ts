import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const commonRoot = join(apiSourceRoot, 'common');
const platformRoot = join(apiSourceRoot, 'platform');

const temporaryRuntimeCommonAllowlist = ['http', 'prisma', 'security'] as const;
const removedTestOnlyCommonOwners = ['architecture', 'contracts', 'reference'] as const;

const knownCommonRemovalTargets = {
  'account-identity-invariant.owner.ts': 'identity/account-identity-invariant',
  deidentification: 'privacy/deidentification',
  'domain-context': 'platform/domain-context plus domain-owned requirement types',
  lifecycle: 'lifecycle or operations/lifecycle',
  lifestyle: 'season-participants/lifestyle',
  moderation: 'moderation',
} as const;

const forbiddenPlatformDomainDirectories = [
  'auth',
  'chat',
  'dormitories',
  'matches',
  'moderation',
  'notifications',
  'profiles',
  'retention',
  'season-participants',
  'seasons',
  'users',
] as const;

const allowedGlobalModules = ['src/common/prisma/prisma.module.ts'] as const;
const knownBusinessGlobalViolations = ['src/common/moderation/moderation.module.ts'] as const;

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

function productionTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root).filter((path) => !path.endsWith('.spec.ts'));
}

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function relativeSourcePath(path: string) {
  return relative(apiRoot, path);
}

function commonTopLevelOwner(path: string) {
  return relative(commonRoot, path).split(sep)[0] ?? '';
}

function filesContaining(root: string, pattern: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => pattern.test(readSource(path)))
    .map(relativeSourcePath)
    .sort();
}

describe('api common final structure boundary', () => {
  it('locks runtime common to temporary platform allowlist plus explicit final-removal targets', () => {
    const actualRuntimeOwners = [
      ...new Set(productionTypeScriptFiles(commonRoot).map(commonTopLevelOwner)),
    ].sort();
    const expectedRuntimeOwners = [
      ...temporaryRuntimeCommonAllowlist,
      ...Object.keys(knownCommonRemovalTargets),
    ].sort();

    expect(actualRuntimeOwners).toEqual(expectedRuntimeOwners);
  });

  it('keeps every non-platform common runtime owner mapped to a canonical final owner', () => {
    const undocumentedRuntimeOwners = productionTypeScriptFiles(commonRoot)
      .map(commonTopLevelOwner)
      .filter(
        (owner) =>
          !temporaryRuntimeCommonAllowlist.includes(
            owner as (typeof temporaryRuntimeCommonAllowlist)[number],
          ) && !Object.hasOwn(knownCommonRemovalTargets, owner),
      )
      .sort();

    expect(undocumentedRuntimeOwners).toEqual([]);
    expect(knownCommonRemovalTargets).toMatchObject({
      moderation: 'moderation',
      lifecycle: 'lifecycle or operations/lifecycle',
      lifestyle: 'season-participants/lifestyle',
    });
  });

  it('keeps architecture and conformance test surfaces out of runtime common', () => {
    const staleTestOnlyOwners = removedTestOnlyCommonOwners
      .filter((owner) => existsSync(join(commonRoot, owner)))
      .map((owner) => `src/common/${owner}`);

    expect(staleTestOnlyOwners).toEqual([]);
    expect(
      existsSync(join(apiSourceRoot, 'architecture/auth/auth-architecture-boundary.spec.ts')),
    ).toBe(true);
    expect(
      existsSync(
        join(apiSourceRoot, 'architecture/api-contracts/shared-reference-contracts.spec.ts'),
      ),
    ).toBe(true);
    expect(
      existsSync(join(apiSourceRoot, 'architecture/reference-data/college-reference-data.spec.ts')),
    ).toBe(true);
  });

  it('keeps future platform code independent from product-domain imports', () => {
    const forbiddenDomainImport = new RegExp(
      String.raw`from\s+['"][^'"]*(?:\.\./)+(?:${forbiddenPlatformDomainDirectories.join(
        '|',
      )})(?:/|['"])|from\s+['"](?:src/)?(?:${forbiddenPlatformDomainDirectories.join(
        '|',
      )})(?:/|['"])`,
    );

    expect(filesContaining(platformRoot, forbiddenDomainImport)).toEqual([]);
  });

  it('keeps business @Global() usage limited to documented violations during migration', () => {
    const globalModuleFiles = filesContaining(apiSourceRoot, /@Global\s*\(\s*\)/);
    const unexpectedGlobalModules = globalModuleFiles.filter(
      (path) =>
        !allowedGlobalModules.includes(path as (typeof allowedGlobalModules)[number]) &&
        !knownBusinessGlobalViolations.includes(
          path as (typeof knownBusinessGlobalViolations)[number],
        ),
    );

    expect(globalModuleFiles).toEqual(
      [...allowedGlobalModules, ...knownBusinessGlobalViolations].sort(),
    );
    expect(unexpectedGlobalModules).toEqual([]);
  });

  it('keeps common documented as a temporary migration bucket', () => {
    const readmePath = join(commonRoot, 'README.md');

    expect(existsSync(readmePath)).toBe(true);
    const source = readSource(readmePath);
    expect(source).toContain('temporary migration bucket');
    expect(source).toContain('Do not add new runtime files');
    expect(source).toContain('api-common-final-structure-refactor-plan.md');
  });
});
