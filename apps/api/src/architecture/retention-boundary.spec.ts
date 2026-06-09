import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '..', '..');
const apiSourceRoot = join(apiRoot, 'src');
const retentionRoot = join(apiSourceRoot, 'retention');
const lifecycleRoot = join(apiSourceRoot, 'lifecycle');
const usersRoot = join(apiSourceRoot, 'users');
const sharedSourceRoot = join(repoRoot, 'packages/shared/src');

const finalRootProductionFiles = ['retention.module.ts'] as const;

const expectedRetentionCompositionFiles = [
  'retention.providers.ts',
  'retention.exports.ts',
  'retention.tokens.ts',
] as const;

const productDomainRoots = [
  'auth',
  'chat',
  'matches',
  'notifications',
  'profiles',
  'season-participants',
  'seasons',
  'social-safety',
  'support',
  'users',
] as const;

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
  return relative(apiRoot, path).split(sep).join('/');
}

function rootRelativePath(path: string, root: string) {
  return relative(root, path).split(sep).join('/');
}

function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
}

function sourceFilesContaining(root: string, pattern: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => pattern.test(readSource(path)))
    .map(relativeSourcePath)
    .sort();
}

function existingRelativeFiles(root: string, files: readonly string[]) {
  return files.filter((file) => existsSync(join(root, file))).sort();
}

describe('retention final architecture boundary', () => {
  it('expected-red Phase 3~8: keeps retention root production files on module surface only', () => {
    const rootProductionFiles = productionTypeScriptFiles(retentionRoot)
      .filter((path) => dirname(path) === retentionRoot)
      .map((path) => rootRelativePath(path, retentionRoot))
      .sort();

    expect({
      expectedGreenPhase: 'Phase 3~8 root owner file split',
      currentRootProductionFiles: rootProductionFiles,
      expectedRootProductionFiles: [...finalRootProductionFiles],
    }).toEqual({
      expectedGreenPhase: 'Phase 3~8 root owner file split',
      currentRootProductionFiles: [...finalRootProductionFiles].sort(),
      expectedRootProductionFiles: [...finalRootProductionFiles],
    });
  });

  it('keeps RetentionModule provider/export composition as source of truth', () => {
    const retentionModulePath = join(retentionRoot, 'retention.module.ts');
    const compositionRoot = join(retentionRoot, 'composition');
    const missingCompositionFiles = expectedRetentionCompositionFiles.filter(
      (file) => !existsSync(join(compositionRoot, file)),
    );
    const moduleSource = existsSync(retentionModulePath) ? readSource(retentionModulePath) : '';

    expect({
      expectedGreenPhase: 'Phase 2 RetentionModule + composition source-of-truth',
      hasRetentionModule: existsSync(retentionModulePath),
      missingCompositionFiles,
      moduleUsesProviderSourceOfTruth: moduleSource.includes('RETENTION_PROVIDERS'),
      moduleUsesExportSourceOfTruth: moduleSource.includes('RETENTION_EXPORTS'),
      moduleHasInlineProvidersArray: /providers:\s*\[/.test(moduleSource),
      moduleHasInlineExportsArray: /exports:\s*\[/.test(moduleSource),
    }).toEqual({
      expectedGreenPhase: 'Phase 2 RetentionModule + composition source-of-truth',
      hasRetentionModule: true,
      missingCompositionFiles: [],
      moduleUsesProviderSourceOfTruth: true,
      moduleUsesExportSourceOfTruth: true,
      moduleHasInlineProvidersArray: false,
      moduleHasInlineExportsArray: false,
    });
  });

  it('keeps lifecycle module on RetentionModule instead of direct retention observability provider', () => {
    const lifecycleModuleSource = readSource(join(lifecycleRoot, 'lifecycle.module.ts'));

    expect({
      expectedGreenPhase: 'Phase 2 RetentionModule import/export wiring',
      directRetentionObservabilityImports: importSpecifiers(lifecycleModuleSource).filter(
        (specifier) => /retention\/retention-observability/.test(specifier),
      ),
      lifecycleModuleImportsRetentionModule: /retention\/retention\.module/.test(
        lifecycleModuleSource,
      ),
    }).toEqual({
      expectedGreenPhase: 'Phase 2 RetentionModule import/export wiring',
      directRetentionObservabilityImports: [],
      lifecycleModuleImportsRetentionModule: true,
    });
  });

  it('expected-red Phase 8: keeps lifecycle sweep tasks on RETENTION_SWEEP_PORT', () => {
    const lifecycleSweepAdapterSource = readSource(
      join(lifecycleRoot, 'adapters/lifecycle-sweep-tasks.adapter.ts'),
    );

    expect({
      expectedGreenPhase: 'Phase 8 RETENTION_SWEEP_PORT migration',
      userRetentionSweepPortReferences:
        lifecycleSweepAdapterSource.match(/USER_RETENTION_SWEEP_PORT/g) ?? [],
      usesRetentionSweepPort: /\bRETENTION_SWEEP_PORT\b/.test(lifecycleSweepAdapterSource),
      directUsersServiceReferences: sourceFilesContaining(
        lifecycleRoot,
        /UsersService|users\.service/,
      ),
    }).toEqual({
      expectedGreenPhase: 'Phase 8 RETENTION_SWEEP_PORT migration',
      userRetentionSweepPortReferences: [],
      usesRetentionSweepPort: true,
      directUsersServiceReferences: [],
    });
  });

  it('expected-red Phase 8: keeps users and lifecycle away from retention root owner functions', () => {
    const forbiddenRetentionRootOwnerImports =
      /from\s+['"][^'"]*retention\/(?:archive-job-owner|retained-identity-owner|retained-vault-owner|retention-access-log-owner|retention-review-job-owner|conversation-retained-body-owner)(?:\.js)?['"]/;
    const roots = [usersRoot, lifecycleRoot];
    const offenders = roots.flatMap((root) =>
      sourceFilesContaining(root, forbiddenRetentionRootOwnerImports),
    );

    expect({
      expectedGreenPhase:
        'Phase 8 users/lifecycle migrate to RETENTION_SWEEP_PORT and retention application ports',
      directRetentionRootOwnerImports: offenders,
    }).toEqual({
      expectedGreenPhase:
        'Phase 8 users/lifecycle migrate to RETENTION_SWEEP_PORT and retention application ports',
      directRetentionRootOwnerImports: [],
    });
  });

  it('keeps archive target registry as thin dispatch without source row transformations', () => {
    const registrySource = readSource(
      join(retentionRoot, 'archive-jobs/targets/archive-target-handlers.ts'),
    );
    const expectedOwnerHandlerFiles = [
      join(apiSourceRoot, 'users/identity/retention/nickname-audit-archive.handler.ts'),
      join(apiSourceRoot, 'users/identity/retention/academic-identity-audit-archive.handler.ts'),
      join(
        apiSourceRoot,
        'season-participants/retention/season-profile-history-archive.handler.ts',
      ),
      join(apiSourceRoot, 'matches/retention/match-history-archive.handler.ts'),
      join(apiSourceRoot, 'chat/retention/thread-retention-archive.handler.ts'),
      join(apiSourceRoot, 'chat/retention/conversation-retained-body.service.ts'),
    ];

    expect({
      expectedGreenPhase: 'Phase 7 domain-owned archive handlers',
      missingOwnerHandlerFiles: expectedOwnerHandlerFiles
        .filter((file) => !existsSync(file))
        .map(relativeSourcePath),
      registryRetainsPayloadDirectly: /retainVaultPayloadTx|ensureRetentionCaseTx/.test(
        registrySource,
      ),
      registryOwnsSourceRowTables:
        /UserDisplayIdentityNicknameChangeEvent|UserAcademicIdentityChangeEvent|SeasonParticipantProfileHistory|SeasonMatchHistoryEntry|ConversationMessage/.test(
          registrySource,
        ),
    }).toEqual({
      expectedGreenPhase: 'Phase 7 domain-owned archive handlers',
      missingOwnerHandlerFiles: [],
      registryRetainsPayloadDirectly: false,
      registryOwnsSourceRowTables: false,
    });
  });

  it('keeps product read paths away from retained payload disclosure/parser internals', () => {
    const forbiddenDisclosureOrParserImports =
      /from\s+['"][^'"]*retention\/(?:vault\/[^'"]*disclosure|retained-vault-owner|conversation-retained-body-owner)(?:\.js)?['"]/;
    const productRoots = productDomainRoots.map((root) => join(apiSourceRoot, root));
    const offenders = productRoots.flatMap((root) =>
      sourceFilesContaining(root, forbiddenDisclosureOrParserImports),
    );

    expect(offenders).toEqual([]);
  });

  it('keeps shared retention contracts nested-only without root or compat re-exports', () => {
    const rootRetentionContractFiles = [
      join(sharedSourceRoot, 'retention-contract.ts'),
      join(sharedSourceRoot, 'compat/retention-contract.ts'),
    ];
    const forbiddenExistingFiles = rootRetentionContractFiles
      .filter((path) => existsSync(path))
      .map((path) => relative(repoRoot, path).split(sep).join('/'));
    const retentionSharedRoot = join(sharedSourceRoot, 'retention');
    const nestedRetentionFiles = existsSync(retentionSharedRoot)
      ? readdirSync(retentionSharedRoot)
          .filter((file) => file.endsWith('.ts'))
          .sort()
      : [];

    expect({
      expectedGreenPhase: 'Phase 10 if shared retention contract is introduced',
      forbiddenExistingFiles,
      nestedRetentionFiles,
    }).toEqual({
      expectedGreenPhase: 'Phase 10 if shared retention contract is introduced',
      forbiddenExistingFiles: [],
      nestedRetentionFiles: existingRelativeFiles(retentionSharedRoot, nestedRetentionFiles),
    });
  });
});
