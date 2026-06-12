import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const commonRoot = join(apiSourceRoot, 'common');
const platformRoot = join(apiSourceRoot, 'platform');

const removedTestOnlyCommonOwners = ['architecture', 'contracts', 'reference'] as const;
const removedPlatformCommonOwners = ['http', 'prisma', 'security'] as const;

const knownCommonRemovalTargets = {} as const;

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

const allowedGlobalModules = ['src/platform/database/prisma.module.ts'] as const;

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
  it('locks runtime common to explicit final-removal targets', () => {
    const actualRuntimeOwners = [
      ...new Set(productionTypeScriptFiles(commonRoot).map(commonTopLevelOwner)),
    ].sort();
    const expectedRuntimeOwners = Object.keys(knownCommonRemovalTargets).sort();

    expect(actualRuntimeOwners).toEqual(expectedRuntimeOwners);
  });

  it('keeps every non-platform common runtime owner mapped to a canonical final owner', () => {
    const undocumentedRuntimeOwners = productionTypeScriptFiles(commonRoot)
      .map(commonTopLevelOwner)
      .filter((owner) => !Object.hasOwn(knownCommonRemovalTargets, owner))
      .sort();

    expect(undocumentedRuntimeOwners).toEqual([]);
    expect(knownCommonRemovalTargets).toEqual({});
  });

  it('deletes the common migration bucket after canonical import completion', () => {
    expect(existsSync(commonRoot)).toBe(false);
  });

  it('keeps architecture and conformance test surfaces out of runtime common', () => {
    const staleTestOnlyOwners = removedTestOnlyCommonOwners
      .filter((owner) => existsSync(join(commonRoot, owner)))
      .map((owner) => `src/common/${owner}`);

    expect(staleTestOnlyOwners).toEqual([]);
    expect(existsSync(join(apiSourceRoot, 'architecture/auth-boundary.spec.ts'))).toBe(true);
    expect(
      existsSync(
        join(apiSourceRoot, 'architecture/api-contracts/shared-reference-contracts.spec.ts'),
      ),
    ).toBe(true);
    expect(
      existsSync(join(apiSourceRoot, 'architecture/reference-data/college-reference-data.spec.ts')),
    ).toBe(true);
  });

  it('keeps platform-neutral runtime owners out of common after canonicalization', () => {
    const stalePlatformOwners = removedPlatformCommonOwners
      .filter((owner) => existsSync(join(commonRoot, owner)))
      .map((owner) => `src/common/${owner}`);

    expect(stalePlatformOwners).toEqual([]);
    expect(existsSync(join(apiSourceRoot, 'platform/http/api-error.ts'))).toBe(true);
    expect(existsSync(join(apiSourceRoot, 'platform/security/opaque-hmac-token.ts'))).toBe(true);
    expect(existsSync(join(apiSourceRoot, 'platform/database/prisma.module.ts'))).toBe(true);
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

  it('keeps identity, privacy, and lifestyle shared-kernel owners outside common', () => {
    expect(existsSync(join(commonRoot, 'account-identity-invariant.owner.ts'))).toBe(false);
    expect(existsSync(join(commonRoot, 'deidentification'))).toBe(false);
    expect(existsSync(join(commonRoot, 'lifestyle'))).toBe(false);
    expect(existsSync(join(apiSourceRoot, 'identity/account-identity-invariant.ts'))).toBe(true);
    expect(
      existsSync(join(apiSourceRoot, 'privacy/deidentification/deidentified-display.policy.ts')),
    ).toBe(true);
    expect(
      existsSync(
        join(apiSourceRoot, 'season-participants/lifestyle/lifestyle-persistence.mapper.ts'),
      ),
    ).toBe(true);
  });

  it('keeps domain context metadata primitive in platform without domain vocabulary', () => {
    const platformDomainContextPath = join(
      apiSourceRoot,
      'platform/domain-context/domain-context.decorator.ts',
    );
    const source = readSource(platformDomainContextPath);

    expect(existsSync(join(commonRoot, 'domain-context'))).toBe(false);
    expect(existsSync(platformDomainContextPath)).toBe(true);
    expect(source).toContain('DOMAIN_CONTEXT_REQUIREMENTS_METADATA_KEY');
    expect(source).not.toMatch(
      /current-season-participant|chat-thread-member|active-match-participant/,
    );
    expect(existsSync(join(apiSourceRoot, 'chat/context/chat-thread-context-requirement.ts'))).toBe(
      true,
    );
    expect(
      existsSync(join(apiSourceRoot, 'matches/context/active-match-context-requirement.ts')),
    ).toBe(true);
    expect(
      existsSync(
        join(
          apiSourceRoot,
          'season-participants/context/current-season-participant-context-requirement.ts',
        ),
      ),
    ).toBe(true);
  });

  it('keeps lifecycle orchestration outside common and composes domain work through adapters', () => {
    const lifecycleRoot = join(apiSourceRoot, 'lifecycle');
    const runnerSource = readSource(join(lifecycleRoot, 'lifecycle-sweep-runner.ts'));
    const serviceSource = readSource(join(lifecycleRoot, 'lifecycle-sweep.service.ts'));
    const appModuleSource = readSource(join(apiSourceRoot, 'app.module.ts'));

    expect(existsSync(join(commonRoot, 'lifecycle'))).toBe(false);
    expect(existsSync(join(lifecycleRoot, 'lifecycle.module.ts'))).toBe(true);
    expect(appModuleSource).toContain('LifecycleModule');
    expect(runnerSource).not.toMatch(
      /MatchesService|UsersService|SeasonParticipantsService|AuthOperationalCleanupService|ChatService/,
    );
    expect(serviceSource).not.toMatch(
      /MatchesService|UsersService|SeasonParticipantsService|AuthOperationalCleanupService|ChatService/,
    );
    expect(existsSync(join(lifecycleRoot, 'adapters/lifecycle-sweep-tasks.adapter.ts'))).toBe(true);
  });

  it('keeps business @Global() usage banned outside platform database', () => {
    const globalModuleFiles = filesContaining(apiSourceRoot, /@Global\s*\(\s*\)/);
    const unexpectedGlobalModules = globalModuleFiles.filter(
      (path) => !allowedGlobalModules.includes(path as (typeof allowedGlobalModules)[number]),
    );

    expect(globalModuleFiles).toEqual([...allowedGlobalModules].sort());
    expect(unexpectedGlobalModules).toEqual([]);
  });

  it('keeps moderation as a top-level non-global business capability module', () => {
    const moderationModulePath = join(apiSourceRoot, 'moderation/moderation.module.ts');

    expect(existsSync(join(commonRoot, 'moderation'))).toBe(false);
    expect(existsSync(moderationModulePath)).toBe(true);
    expect(readSource(moderationModulePath)).not.toContain('@Global()');
    expect(existsSync(join(apiSourceRoot, 'moderation/moderation.repository.ts'))).toBe(true);
    expect(existsSync(join(apiSourceRoot, 'moderation/text-moderation.policy.ts'))).toBe(true);
  });

  it('keeps common runtime bucket deleted instead of documented as a final owner', () => {
    expect(existsSync(join(commonRoot, 'README.md'))).toBe(false);
    expect(productionTypeScriptFiles(commonRoot)).toEqual([]);
  });
});
