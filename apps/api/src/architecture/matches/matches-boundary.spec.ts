import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

type TransitionMap = Record<string, string>;
type PackageExportTarget = { types: string; default: string };
type PackageJson = { exports: Record<string, PackageExportTarget | undefined> };

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '../..');
const apiSourceRoot = join(apiRoot, 'src');
const matchesRoot = join(apiSourceRoot, 'matches');
const sharedRoot = join(repoRoot, 'packages/shared');
const sharedSrc = join(sharedRoot, 'src');
const prismaSchemaPath = join(apiRoot, 'prisma/schema.prisma');
const baselineMigrationPath = join(
  apiRoot,
  'prisma/migrations/000000000000_initial_baseline/migration.sql',
);

const finalRootProductionFiles = ['matches.controller.ts', 'matches.module.ts'] as const;
const finalRootSpecFiles = ['matches.controller.spec.ts'] as const;
const requiredReadmeSections = [
  '# Matches API module architecture',
  '## Public boundary',
  '## Owned responsibilities',
  '## Non-responsibilities',
  '## Directory responsibilities',
  '## Transaction and concurrency invariants',
  '## External domain boundaries',
  '## Where to change match behavior',
  '## Architecture guard expectation',
] as const;

const rootProductionTransitionFiles: TransitionMap = {
  'matches.errors.ts': 'Phase 9 errors slice migration',
  'matches.service.ts': 'Phase 12 controller facade relocation',
};

const rootSpecTransitionFiles: TransitionMap = {
  'matches.service.spec.ts': 'Phase 12 facade smoke spec relocation/removal',
};

const concreteMatchesServiceTransitionConsumers: TransitionMap = {};

const externalMatchMutationTransitionFiles: TransitionMap = {
  'src/season-participants/deregistration/deregister-season-participant.command.ts':
    'Phase 7 participant withdrawal match side-effect port decision',
};

const removedSharedMatchFlatExports = [
  './match-contract',
  './match-score',
  './match/score',
] as const;

const finalSharedMatchExports: Record<string, PackageExportTarget> = {
  './match': {
    types: './dist/match/index.d.ts',
    default: './dist/match/index.js',
  },
  './match/contract': {
    types: './dist/match/contract/index.d.ts',
    default: './dist/match/contract/index.js',
  },
};

const phase10ScoringFiles = [
  'scoring/match-score.algorithm.ts',
  'scoring/match-score.algorithm.spec.ts',
  'scoring/match-score-projection.ts',
  'scoring/match-score-projection.spec.ts',
  'application/ports/match-score-projection.port.ts',
] as const;

const phase2PortFiles = [
  'application/ports/match-active-view.port.ts',
  'application/ports/match-lifecycle-sweep.port.ts',
  'application/ports/match-history-materialization.port.ts',
  'application/ports/match-score-projection.port.ts',
] as const;

const phase8_1ExtractedFiles = [
  'context/match-context.resolver.ts',
  'active/presenters/active-match.presenter.ts',
  'active/presenters/active-match.presenter.spec.ts',
  'persistence/match-pair-identity.ts',
  'persistence/match-pair-identity.spec.ts',
  'requests/policies/match-request-expiration.policy.ts',
  'requests/policies/match-request-expiration.policy.spec.ts',
  'requests/commands/match-request-command-flow.spec.ts',
  'active/commands/unmatch-command-flow.spec.ts',
  'test-support/matches-service-spec.harness.ts',
] as const;

const activeMatchLifecycleEventInternalConsumers = [
  'src/matches/active/commands/cancel-unmatch-request.command.ts',
  'src/matches/active/commands/request-unmatch.command.ts',
  'src/matches/active/lifecycle/active-match-lifecycle-sweep.service.ts',
  'src/matches/active/lifecycle-events/active-match-lifecycle-event.repository.ts',
  'src/matches/active/lifecycle-events/active-match-lifecycle-event.writer.ts',
  'src/matches/composition/matches.providers.ts',
  'src/matches/requests/commands/accept-match-request.command.ts',
  'src/matches/test-support/matches-service-spec.harness.ts',
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

function apiRelative(path: string) {
  return relative(apiRoot, path).split(sep).join('/');
}

function rootTypeScriptFileNames(root: string, spec: boolean) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name)
    .filter((file) => (spec ? file.endsWith('.spec.ts') : !file.endsWith('.spec.ts')))
    .sort();
}

function filesContaining(root: string, forbidden: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => forbidden.test(readSource(path)))
    .map(apiRelative)
    .sort();
}

function externalProductionFiles() {
  const matchesPrefix = `${matchesRoot}${sep}`;
  const generatedPrefix = `${join(apiSourceRoot, 'generated')}${sep}`;
  return productionTypeScriptFiles(apiSourceRoot).filter(
    (path) => !path.startsWith(matchesPrefix) && !path.startsWith(generatedPrefix),
  );
}

function externalFilesContaining(forbidden: RegExp) {
  return externalProductionFiles()
    .filter((path) => forbidden.test(readSource(path)))
    .map(apiRelative)
    .sort();
}

function readSharedPackageJson() {
  return JSON.parse(readFileSync(join(sharedRoot, 'package.json'), 'utf8')) as PackageJson;
}

function sortedKeys(map: TransitionMap) {
  return Object.keys(map).sort();
}

function countLines(path: string) {
  return readSource(path).split('\n').length;
}

describe('matches architecture boundary', () => {
  it('keeps the product README as the matches boundary orientation source', () => {
    const readmePath = join(matchesRoot, 'README.md');
    expect(existsSync(readmePath)).toBe(true);

    const source = readSource(readmePath);
    for (const section of requiredReadmeSections) {
      expect(source).toContain(section);
    }
  });

  it('tracks root production files as exact phase-owned transition violations', () => {
    const actualRootProductionFiles = rootTypeScriptFileNames(matchesRoot, false);
    const transitionFiles = actualRootProductionFiles.filter(
      (file) =>
        !finalRootProductionFiles.includes(file as (typeof finalRootProductionFiles)[number]),
    );

    expect(transitionFiles).toEqual(sortedKeys(rootProductionTransitionFiles));
    expect(rootProductionTransitionFiles['matches.service.ts']).toContain('Phase 12');
  });

  it('tracks root spec files as exact phase-owned transition violations', () => {
    const actualRootSpecFiles = rootTypeScriptFileNames(matchesRoot, true);
    const transitionFiles = actualRootSpecFiles.filter(
      (file) => !finalRootSpecFiles.includes(file as (typeof finalRootSpecFiles)[number]),
    );

    expect(transitionFiles).toEqual(sortedKeys(rootSpecTransitionFiles));
    expect(rootSpecTransitionFiles['matches.service.spec.ts']).toContain('facade smoke spec');
  });

  it('keeps Phase 8-1 root-transition extractions in owning slices', () => {
    for (const relativePath of phase8_1ExtractedFiles) {
      expect(existsSync(join(matchesRoot, relativePath))).toBe(true);
    }

    for (const removedRootFile of [
      'match-context-owner.ts',
      'match-read-model.ts',
      'match-read-model.spec.ts',
      'match.utils.ts',
      'match.utils.spec.ts',
    ]) {
      expect(existsSync(join(matchesRoot, removedRootFile))).toBe(false);
    }

    expect(countLines(join(matchesRoot, 'matches.service.spec.ts'))).toBeLessThanOrEqual(120);
  });

  it('keeps Phase 10 score algorithm and projection in the scoring slice', () => {
    for (const relativePath of phase10ScoringFiles) {
      expect(existsSync(join(matchesRoot, relativePath))).toBe(true);
    }

    for (const removedRootFile of [
      'match-score-projection.ts',
      'match-score-projection.spec.ts',
      'match-score.spec.ts',
    ]) {
      expect(existsSync(join(matchesRoot, removedRootFile))).toBe(false);
    }
  });

  it('keeps external production code off concrete MatchesService after port migration', () => {
    const concreteConsumers = externalFilesContaining(
      /from\s+['"][^'"]*matches\/matches\.service(?:\.js)?['"]|\bMatchesService\b/,
    );

    expect(concreteConsumers).toEqual(sortedKeys(concreteMatchesServiceTransitionConsumers));
  });

  it('keeps match ports and composition source-of-truth without concrete service exports', () => {
    const moduleSource = readSource(join(matchesRoot, 'matches.module.ts'));
    const providersSource = readSource(join(matchesRoot, 'composition/matches.providers.ts'));
    const exportsSource = readSource(join(matchesRoot, 'composition/matches.exports.ts'));

    for (const relativePath of phase2PortFiles) {
      expect(existsSync(join(matchesRoot, relativePath))).toBe(true);
    }
    expect(moduleSource).toContain('providers: MATCHES_PROVIDERS');
    expect(moduleSource).toContain('exports: MATCHES_EXPORTS');
    for (const finalPort of [
      'MATCH_ACTIVE_VIEW_PORT',
      'MATCH_LIFECYCLE_SWEEP_PORT',
      'MATCH_HISTORY_MATERIALIZATION_PORT',
      'MATCH_BLOCK_SIDE_EFFECT_PORT',
      'MATCH_SCORE_PROJECTION_PORT',
    ]) {
      expect(providersSource).toContain(finalPort);
      expect(exportsSource).toContain(finalPort);
    }
    expect(existsSync(join(matchesRoot, 'active/queries/active-match-view.query.ts'))).toBe(true);
    expect(providersSource).toContain('ActiveMatchViewQuery');
    expect(providersSource).toContain('useExisting: ActiveMatchViewQuery');
    expect(providersSource).toContain('ActiveMatchLifecycleSweepService');
    expect(providersSource).toContain('useExisting: ActiveMatchLifecycleSweepService');
    expect(providersSource).toContain('MatchHistoryMaterializationService');
    expect(providersSource).toContain('useExisting: MatchHistoryMaterializationService');
    expect(providersSource).toContain('MatchScoreProjectionService');
    expect(providersSource).toContain('useExisting: MatchScoreProjectionService');
    expect(exportsSource).not.toContain('MatchesService');
    expect(exportsSource).not.toContain('Temporary transition export');
  });

  it('keeps ActiveMatch lifecycle event append internals private to matches owners', () => {
    const lifecycleEventInternalPattern =
      /from\s+['"][^'"]*matches\/active\/lifecycle-events\/[^'"]*['"]|\bActiveMatchLifecycleEvent(?:Writer|Repository)\b/;
    const internalConsumers = productionTypeScriptFiles(matchesRoot)
      .filter((path) => lifecycleEventInternalPattern.test(readSource(path)))
      .map(apiRelative)
      .sort();
    const externalConsumers = externalFilesContaining(lifecycleEventInternalPattern);
    const exportsSource = readSource(join(matchesRoot, 'composition/matches.exports.ts'));

    expect(externalConsumers).toEqual([]);
    expect(internalConsumers).toEqual([...activeMatchLifecycleEventInternalConsumers].sort());
    expect(exportsSource).not.toMatch(
      /ActiveMatchLifecycleEvent(?:Writer|Repository)|active\/lifecycle-events/,
    );
  });

  it('keeps future request policies pure from Nest providers and Prisma infrastructure', () => {
    const policyRoots = [
      join(matchesRoot, 'requests/policies'),
      join(matchesRoot, 'active/policies'),
    ];
    const forbidden =
      /from\s+['"].*(?:@nestjs|generated\/prisma|platform\/database)|\bPrismaService\b|\bInjectable\b/;

    for (const policyRoot of policyRoots) {
      expect(filesContaining(policyRoot, forbidden)).toEqual([]);
    }
  });

  it('tracks external direct match mutations until they are moved behind match-owned ports', () => {
    const directMutationFiles = externalFilesContaining(
      /\b(?:matchRequest|activeMatch)\.(?:create|update|updateMany|delete|deleteMany|upsert)\s*\(/,
    );

    expect(directMutationFiles).toEqual(sortedKeys(externalMatchMutationTransitionFiles));
  });

  it('keeps match history materialization free of chat-derived state', () => {
    const materializationFiles = productionTypeScriptFiles(
      join(matchesRoot, 'history/materialization'),
    ).filter((path) => existsSync(path));

    const offenders = materializationFiles
      .filter((path) =>
        /\bConversationThread\b|\bConversationMessage\b|conversationThreads|lastMessageAt|hadConversation|threadClosedReason/.test(
          readSource(path),
        ),
      )
      .map(apiRelative)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('keeps shared match contract nested and score algorithm API-owned after Phase 10', () => {
    const rootMatchFiles = readdirSync(sharedSrc, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
      .map((entry) => entry.name)
      .filter((file) => file.startsWith('match-contract') || file === 'match-score.ts')
      .sort();
    const sharedPackageJson = readSharedPackageJson();

    expect(rootMatchFiles).toEqual([]);
    expect(existsSync(join(sharedSrc, 'match/contract/index.ts'))).toBe(true);
    expect(existsSync(join(sharedSrc, 'match/contract/history.ts'))).toBe(true);
    for (const [publicPath, expectedTarget] of Object.entries(finalSharedMatchExports)) {
      expect(sharedPackageJson.exports[publicPath]).toEqual(expectedTarget);
    }
    for (const publicPath of removedSharedMatchFlatExports) {
      expect(sharedPackageJson.exports[publicPath]).toBeUndefined();
    }
  });

  it('keeps Phase 11 matches query/index hardening in schema and baseline migration', () => {
    const schema = readSource(prismaSchemaPath);
    const baselineMigration = readSource(baselineMigrationPath);

    for (const schemaIndex of [
      '@@index([seasonId, requesterParticipantId, createdAt, id])',
      '@@index([seasonId, receiverParticipantId, createdAt, id])',
      '@@index([seasonId, status, expiresAt])',
      '@@index([seasonId, pairKey, status])',
      '@@index([status, endedAt, startedAt, id])',
      '@@index([viewerParticipantId, finalizedAt, createdAt, id])',
    ]) {
      expect(schema).toContain(schemaIndex);
    }

    for (const migrationIndex of [
      'ON "MatchRequest"("seasonId", "requesterParticipantId", "createdAt", "id")',
      'ON "MatchRequest"("seasonId", "receiverParticipantId", "createdAt", "id")',
      'ON "MatchRequest"("seasonId", "status", "expiresAt")',
      'ON "MatchRequest"("seasonId", "pairKey", "status")',
      'ON "ActiveMatch"("status", "endedAt", "startedAt", "id")',
      'ON "SeasonMatchHistoryEntry"("viewerParticipantId", "finalizedAt", "createdAt", "id")',
    ]) {
      expect(baselineMigration).toContain(migrationIndex);
    }
  });
});
