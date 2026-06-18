import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

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

describe('matches architecture boundary', () => {
  it('keeps score algorithm and projection in the scoring owner', () => {
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

  it('keeps shared match contract independent from the API-owned score algorithm', () => {
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

  it('keeps matches query indexes in schema and baseline migration', () => {
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
