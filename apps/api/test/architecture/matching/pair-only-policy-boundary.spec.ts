import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const workspaceRoot = join(apiRoot, '../..');
const officialPolicyRoot = join(workspaceRoot, 'docs/policies');
const sharedMatchContractRoot = join(workspaceRoot, 'packages/shared/src/match/contract');
const prismaMigrationsRoot = join(apiRoot, 'prisma/migrations');

function read(path: string) {
  return readFileSync(path, 'utf8');
}

function declaredNames(source: string, kind: 'model' | 'enum') {
  return [...source.matchAll(new RegExp(`^${kind}\\s+(\\w+)`, 'gm'))].map((match) => match[1]!);
}

function sourceFiles(root: string, extension: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path, extension);
    }
    return entry.isFile() && entry.name.endsWith(extension) ? [path] : [];
  });
}

describe('pair-only matching policy boundary', () => {
  it('current official policy owns pair-only scope without relying on a historical group design', () => {
    const matchingPolicy = read(join(officialPolicyRoot, 'matching-lifecycle.md'));
    const officialIndex = read(join(officialPolicyRoot, 'README.md'));
    const seasonPolicy = read(join(officialPolicyRoot, 'season-lifecycle.md'));

    expect(matchingPolicy).toMatch(/2인 매칭만 제공/u);
    expect(matchingPolicy).toMatch(/room type metadata[\s\S]*group matching capability/u);
    expect(matchingPolicy).toMatch(/3인 group matching[\s\S]*(?:지원하지|제공하지)/u);

    expect(officialIndex).toContain('[matching-lifecycle.md](./matching-lifecycle.md)');
    expect(officialIndex).not.toContain('group-matching-lifecycle.md');
    expect(seasonPolicy).toMatch(/3인실 room capacity[\s\S]*group matching capability/u);
  });

  it('matches API exposes only the pair request, active relation, overview, and history routes', () => {
    const controllerSource = read(join(apiRoot, 'src/matches/matches.controller.ts'));
    const routeDeclarations = [...controllerSource.matchAll(/@(Get|Post)\('([^']+)'\)/g)].map(
      ([, method, path]) => `${method} ${path}`,
    );

    expect(controllerSource).toContain("@Controller('api/matches')");
    expect(routeDeclarations).toEqual([
      'Get requests',
      'Get overview',
      'Post requests',
      'Post requests/:id/accept',
      'Post requests/:id/reject',
      'Post requests/:id/cancel',
      'Get active',
      'Get history',
      'Get history/entries/:entryId/counterpart-profile',
      'Post active/:id/unmatch-request',
      'Post active/:id/unmatch-request/cancel',
    ]);

    const moduleSource = read(join(apiRoot, 'src/matches/matches.module.ts'));
    const providerSource = read(join(apiRoot, 'src/matches/composition/matches.providers.ts'));
    const exportSource = read(join(apiRoot, 'src/matches/composition/matches.exports.ts'));

    expect(`${moduleSource}\n${providerSource}\n${exportSource}`).not.toMatch(
      /\b(?:GroupMatch|GroupMatching|MatchGroup)\b/,
    );
  });

  it('matches README describes group matching as unsupported rather than a deferred projection', () => {
    const matchesReadme = read(join(apiRoot, 'src/matches/README.md'));

    expect(matchesReadme).toMatch(/2-person match semantics/u);
    expect(matchesReadme).toMatch(/지원하지 않는\s+group matching projection/u);
  });

  it('shared overview and public match exports do not add a group projection or contract', () => {
    const responseSource = read(join(sharedMatchContractRoot, 'response.ts'));
    const contractIndexSource = read(join(sharedMatchContractRoot, 'index.ts'));
    const sharedContractSource = sourceFiles(sharedMatchContractRoot, '.ts').map(read).join('\n');
    const overviewBody = responseSource.match(
      /export const matchOverviewResponseSchema = z\.strictObject\(\{([\s\S]*?)\}\);/,
    )?.[1];

    expect(overviewBody).toBeDefined();
    expect([...overviewBody!.matchAll(/^ {2}(\w+):/gm)].map((match) => match[1])).toEqual([
      'serverNow',
      'season',
      'capability',
      'sentRequests',
      'receivedRequests',
      'activeMatch',
      'activity',
    ]);
    expect(contractIndexSource).not.toMatch(/export\s+.*group/i);
    expect(readdirSync(sharedMatchContractRoot)).not.toContain('group.ts');
    expect(sharedContractSource).not.toMatch(/\b(?:GroupMatch|GroupMatching|MatchGroup)\b/);
  });

  it('Prisma keeps match persistence on pair request, active relation, unmatch, and history aggregates', () => {
    const schemaSource = read(join(apiRoot, 'prisma/schema.prisma'));
    const migrationSource = sourceFiles(prismaMigrationsRoot, '.sql').map(read).join('\n');
    const matchModels = declaredNames(schemaSource, 'model').filter((name) =>
      name.includes('Match'),
    );
    const matchEnums = declaredNames(schemaSource, 'enum').filter((name) =>
      /^(?:Match|ActiveMatch|SeasonMatch)/.test(name),
    );

    expect(matchModels).toEqual([
      'MatchRequest',
      'ActiveMatch',
      'ActiveMatchUnmatchRequest',
      'ActiveMatchLifecycleEvent',
      'SeasonMatchHistoryEntry',
      'SeasonMatchHistoryEntryRetentionLink',
    ]);
    expect(matchEnums).toEqual([
      'MatchRequestStatus',
      'MatchRequestTerminalReason',
      'MatchHistorySystemCancellationCause',
      'ActiveMatchStatus',
      'ActiveMatchEndReason',
      'ActiveMatchUnmatchRequestStatus',
      'ActiveMatchLifecycleEventType',
      'ActiveMatchLifecycleEventReason',
      'ActiveMatchLifecycleActorType',
      'SeasonMatchHistoryEntryType',
      'SeasonMatchHistoryEntryResult',
    ]);
    expect(schemaSource).toMatch(/requesterParticipantId\s+String/);
    expect(schemaSource).toMatch(/receiverParticipantId\s+String/);
    expect(schemaSource).toMatch(/participantAId\s+String/);
    expect(schemaSource).toMatch(/participantBId\s+String/);
    expect(schemaSource).not.toMatch(
      /^(?:model|enum)\s+(?:GroupMatch|GroupMatching|MatchGroup)\w*/m,
    );
    expect(migrationSource).not.toMatch(
      /CREATE\s+(?:TABLE|TYPE)\s+"(?:\w*Group\w*Match|\w*Match\w*Group|ThreePersonMatch)\w*"/i,
    );
  });
});
