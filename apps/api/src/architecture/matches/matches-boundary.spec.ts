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
  'match-context-owner.ts': 'Phase 3 context/active view split',
  'match-history-materialization-owner.ts': 'Phase 8 history materialization split',
  'match-history-read-model.ts': 'Phase 8 history read/presenter split',
  'match-history-read-owner.ts': 'Phase 8 history read query split',
  'match-lifecycle-owner.ts': 'Phase 7 lifecycle sweep port split',
  'match-read-model.ts': 'Phase 3/4 active and request presenters split',
  'match-request-command-cluster.ts': 'Phase 4 request command split',
  'match-request-preparation.ts': 'Phase 4 request eligibility split',
  'match-request-step-owner.ts': 'Phase 5 accept/terminal request split',
  'match-score-projection.ts': 'Phase 10 scoring/shared contract split',
  'match-selects.ts': 'Phase 3/4 persistence select split',
  'match-transaction-helpers.ts': 'Phase 4 persistence lock split',
  'match-unmatch-command-cluster.ts': 'Phase 6 unmatch command split',
  'match-unmatch-support.ts': 'Phase 6 unmatch policy/repository split',
  'match.utils.ts': 'Phase 4 request utility split',
  'matches.errors.ts': 'Phase 4 errors slice migration',
  'matches.service.ts': 'Phase 2/3 controller facade relocation',
};

const rootSpecTransitionFiles: TransitionMap = {
  'match-history-materialization-owner.spec.ts': 'Phase 8 history materialization spec split',
  'match-history-read-model.spec.ts': 'Phase 8 history presenter spec split',
  'match-read-model.spec.ts': 'Phase 3/4 presenter spec split',
  'match-score-projection.spec.ts': 'Phase 10 scoring spec split',
  'match-score.spec.ts': 'Phase 10 shared score spec split',
  'match.utils.spec.ts': 'Phase 4 utility/policy spec split',
  'matches.service.spec.ts': 'Phase 4~8 god spec split',
};

const concreteMatchesServiceTransitionConsumers: TransitionMap = {
  'src/lifecycle/adapters/lifecycle-sweep-tasks.adapter.ts': 'Phase 7 lifecycle sweep ports',
};

const externalMatchMutationTransitionFiles: TransitionMap = {
  'src/season-participants/deregistration/deregister-season-participant.command.ts':
    'Phase 7 participant withdrawal match side-effect port decision',
};

const sharedMatchRootTransitionFiles = [
  'match-contract-enums.ts',
  'match-contract-history.ts',
  'match-contract-request.ts',
  'match-contract-response.ts',
  'match-contract-summary.ts',
  'match-contract.ts',
  'match-score.ts',
] as const;

const sharedMatchFlatExports: Record<string, PackageExportTarget> = {
  './match-contract': {
    types: './dist/match-contract.d.ts',
    default: './dist/match-contract.js',
  },
  './match-score': {
    types: './dist/match-score.d.ts',
    default: './dist/match-score.js',
  },
};

const finalSharedMatchExports = ['./match', './match/contract', './match/score'] as const;

const phase2PortFiles = [
  'application/ports/match-active-view.port.ts',
  'application/ports/match-lifecycle-sweep.port.ts',
  'application/ports/match-history-materialization.port.ts',
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

function repoRelative(path: string) {
  return relative(repoRoot, path).split(sep).join('/');
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
    expect(rootProductionTransitionFiles['matches.service.ts']).toContain('Phase 2/3');
  });

  it('tracks root spec files as exact phase-owned transition violations', () => {
    const actualRootSpecFiles = rootTypeScriptFileNames(matchesRoot, true);
    const transitionFiles = actualRootSpecFiles.filter(
      (file) => !finalRootSpecFiles.includes(file as (typeof finalRootSpecFiles)[number]),
    );

    expect(transitionFiles).toEqual(sortedKeys(rootSpecTransitionFiles));
    expect(rootSpecTransitionFiles['matches.service.spec.ts']).toContain('god spec split');
  });

  it('tracks concrete MatchesService external consumers until active/lifecycle ports replace them', () => {
    const concreteConsumers = externalFilesContaining(
      /from\s+['"][^'"]*matches\/matches\.service(?:\.js)?['"]|\bMatchesService\b/,
    );

    expect(concreteConsumers).toEqual(sortedKeys(concreteMatchesServiceTransitionConsumers));
  });

  it('keeps match ports and composition source-of-truth while concrete export is temporary', () => {
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
    ]) {
      expect(providersSource).toContain(finalPort);
      expect(exportsSource).toContain(finalPort);
    }
    expect(existsSync(join(matchesRoot, 'active/queries/active-match-view.query.ts'))).toBe(true);
    expect(providersSource).toContain('ActiveMatchViewQuery');
    expect(providersSource).toContain('useExisting: ActiveMatchViewQuery');
    expect(providersSource).toContain('useExisting: MatchesService');
    expect(exportsSource).toContain('MatchesService');
    expect(exportsSource).toContain('Temporary transition export');
  });

  it('keeps future request policies pure from Nest providers and Prisma infrastructure', () => {
    const policyRoot = join(matchesRoot, 'requests/policies');
    const forbidden =
      /from\s+['"].*(?:@nestjs|generated\/prisma|platform\/database)|\bPrismaService\b|\bInjectable\b/;

    expect(filesContaining(policyRoot, forbidden)).toEqual([]);
  });

  it('tracks external direct match mutations until they are moved behind match-owned ports', () => {
    const directMutationFiles = externalFilesContaining(
      /\b(?:matchRequest|activeMatch)\.(?:create|update|updateMany|delete|deleteMany|upsert)\s*\(/,
    );

    expect(directMutationFiles).toEqual(sortedKeys(externalMatchMutationTransitionFiles));
  });

  it('keeps match history materialization free of chat-derived state', () => {
    const materializationFiles = [
      join(matchesRoot, 'match-history-materialization-owner.ts'),
      ...productionTypeScriptFiles(join(matchesRoot, 'history/materialization')),
    ].filter((path) => existsSync(path));

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

  it('tracks shared match flat contract as a Phase 10 transition owner', () => {
    const rootMatchFiles = readdirSync(sharedSrc, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
      .map((entry) => entry.name)
      .filter((file) => file.startsWith('match-contract') || file === 'match-score.ts')
      .sort();
    const sharedPackageJson = readSharedPackageJson();

    expect(rootMatchFiles).toEqual([...sharedMatchRootTransitionFiles].sort());
    for (const [publicPath, expectedTarget] of Object.entries(sharedMatchFlatExports)) {
      expect(sharedPackageJson.exports[publicPath]).toEqual(expectedTarget);
    }
    for (const publicPath of finalSharedMatchExports) {
      expect(sharedPackageJson.exports[publicPath]).toBeUndefined();
    }
    expect(repoRelative(join(sharedSrc, 'match-contract.ts'))).toBe(
      'packages/shared/src/match-contract.ts',
    );
  });
});
