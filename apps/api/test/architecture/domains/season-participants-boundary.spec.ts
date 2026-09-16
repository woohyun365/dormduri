import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { AuthModule } from '../../../src/auth/auth.module.js';
import { DormitoriesModule } from '../../../src/dormitories/dormitories.module.js';
import { dirname, join, posix, relative, sep } from 'node:path';
import ts from 'typescript';
import { CurrentSeasonParticipantContextGuard } from '../../../src/season-participants/context/current-season-participant-context.guard.js';
import {
  CurrentSeasonParticipationController,
  CurrentSeasonProfileController,
} from '../../../src/season-participants/current-season-participation.controller.js';
import { CurrentSeasonParticipationViewQuery } from '../../../src/season-participants/application/current-season-participation-view.query.js';
import { SeasonParticipantsModule } from '../../../src/season-participants/season-participants.module.js';
import { SeasonParticipantsService } from '../../../src/season-participants/application/season-participants.service.js';
import { UsersModule } from '../../../src/users/users.module.js';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const seasonParticipantsRoot = join(apiSourceRoot, 'season-participants');
const platformDomainContextRoot = join(apiSourceRoot, 'platform/domain-context');

function moduleMetadata<T>(
  target: object,
  key: 'imports' | 'controllers' | 'providers' | 'exports',
): T[] {
  return (Reflect.getMetadata(key, target) ?? []) as T[];
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

function productionTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root).filter((path) => !path.endsWith('.spec.ts'));
}

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function relativeSourcePath(path: string) {
  return relative(apiRoot, path);
}

function rootRelativePath(path: string, root: string) {
  return relative(root, path).split(sep).join('/');
}

function filesContaining(root: string, pattern: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => pattern.test(readSource(path)))
    .map(relativeSourcePath)
    .sort();
}

// Public providers/barrels and existing pure projections, not directory-wide exceptions.
const participantPublicSurfaces = {
  'season-participants.module': 'module wiring',
  'application/season-participants.service': 'public facade, including target snapshot reads',
  'application/current-season-participation-view.query': 'current-user view provider',
  'context/current-season-participant-context.guard': 'route-level context guard',
  'capabilities/index': 'pure capability barrel',
  'policies/index': 'pure policy barrel',
  'public-target-policy/index': 'pure target policy barrel, not its DB-backed query factory',
  'lifestyle/lifestyle-persistence.mapper': 'existing pure lifestyle projection',
  'participants/season-participant-records': 'existing pure selectors, mappers and types',
};
const participantArchiveCaller = 'retention/archive-jobs/targets/archive-target-handlers.ts';
const participantArchiveTarget = 'retention/season-profile-history-archive.handler';

function participantImportViolations(caller: string, source: string): string[] {
  if (caller.startsWith('season-participants/')) return [];
  const file = ts.createSourceFile(caller, source, ts.ScriptTarget.Latest, true);
  const violations = new Set<string>();
  // Literal module references only; runtime-computed imports require semantic review.
  function inspect(node: ts.Node | undefined) {
    if (!node || !ts.isStringLiteralLike(node)) return;
    const path = posix
      .normalize(
        node.text.startsWith('.') ? posix.join(posix.dirname(caller), node.text) : node.text,
      )
      .replace(/\.(?:js|ts)$/, '');
    if (!path.startsWith('season-participants/')) return;
    const target = path.slice('season-participants/'.length);
    if (Object.hasOwn(participantPublicSurfaces, target)) return;
    // Source-owned archive handler is only consumed by this worker registry.
    if (caller === participantArchiveCaller && target === participantArchiveTarget) return;
    violations.add(path);
  }
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) inspect(node.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference))
      inspect(node.moduleReference.expression);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      inspect(node.argument.literal);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    )
      inspect(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...violations].sort();
}

describe('season-participants product architecture boundary', () => {
  it('keeps current season profile/participation controllers owned by SeasonParticipantsModule', () => {
    const controllers = moduleMetadata<unknown>(SeasonParticipantsModule, 'controllers');
    const imports = moduleMetadata<unknown>(SeasonParticipantsModule, 'imports');
    const usersControllers = moduleMetadata<unknown>(UsersModule, 'controllers');

    expect(controllers).toEqual(
      expect.arrayContaining([
        CurrentSeasonProfileController,
        CurrentSeasonParticipationController,
      ]),
    );
    expect(imports).toEqual(expect.arrayContaining([DormitoriesModule, AuthModule]));
    expect(usersControllers).not.toContain(CurrentSeasonProfileController);
    expect(usersControllers).not.toContain(CurrentSeasonParticipationController);
  });

  it('keeps profile draft command isolated from dormitory-selection owner internals', () => {
    const commandSource = readSource(
      join(seasonParticipantsRoot, 'profile-draft/upsert-season-profile-draft.command.ts'),
    );

    expect(commandSource).not.toMatch(/dormitory-selection\.owner/);
    expect(commandSource).not.toMatch(/assertParticipantAllowsDormitorySelection/);
    expect(commandSource).not.toMatch(/hasParticipantDormitorySelection/);
  });

  it('keeps registration finalize command isolated from root owner and history mapping leakage', () => {
    const commandSource = readSource(
      join(seasonParticipantsRoot, 'registration/finalize-season-registration.command.ts'),
    );

    expect(commandSource).not.toMatch(/season-registration-finalize\.owner/);
    expect(commandSource).toContain('toSeasonProfileHistoryCreateData');
    expect(commandSource).toContain('createFinalizeSeasonRegistrationCommand');
  });

  it('keeps deregistration command isolated from root owner and preserves side-effect boundary', () => {
    const commandSource = readSource(
      join(seasonParticipantsRoot, 'deregistration/deregister-season-participant.command.ts'),
    );

    expect(commandSource).not.toMatch(/season-participant-deregistration\.owner/);
    expect(commandSource).toContain('markOpenDirectThreadsReadOnlyForWithdrawnParticipant');
    expect(commandSource).toContain('tx.activeMatch.findFirst');
  });

  it('keeps lifecycle event log as an audit-only slice wired from write owners', () => {
    const registrationSource = readSource(
      join(seasonParticipantsRoot, 'registration/finalize-season-registration.command.ts'),
    );
    const deregistrationSource = readSource(
      join(seasonParticipantsRoot, 'deregistration/deregister-season-participant.command.ts'),
    );
    const backfillSource = readSource(
      join(seasonParticipantsRoot, 'lifecycle/backfill-current-season-participants.command.ts'),
    );
    const lifecycleWriterSource = readSource(
      join(seasonParticipantsRoot, 'lifecycle/season-participant-lifecycle-event.writer.ts'),
    );

    expect(backfillSource).toContain('recordJoinedMany');
    expect(registrationSource).toContain('recordActivated');
    expect(deregistrationSource).toContain('recordWithdrawn');
    expect(lifecycleWriterSource).toContain('mapSeasonParticipantLifecycleMetadata');
    expect(lifecycleWriterSource).not.toMatch(/profile:\s*input/);
    expect(lifecycleWriterSource).not.toMatch(/lifestyle:\s*input/);
  });

  it('keeps external domains from importing season-participants command/query/repository internals', () => {
    const externalFiles = productionTypeScriptFiles(apiSourceRoot).filter(
      (path) => !path.startsWith(seasonParticipantsRoot),
    );
    const offenders = externalFiles
      .filter(
        (path) =>
          participantImportViolations(rootRelativePath(path, apiSourceRoot), readSource(path))
            .length > 0,
      )
      .map(relativeSourcePath)
      .sort();

    expect(offenders).toEqual([]);
  });

  it.each([
    'commands/legacy.command',
    'queries/legacy.query',
    'repositories/legacy.repository',
    'deregistration/deregister-season-participant.command',
    'lifecycle/backfill-current-season-participants.command',
    'lifecycle/season-participant-lifecycle-event.repository',
    'registration/finalize-season-registration.command',
    'profile-draft/upsert-season-profile-draft.command',
    'participants/season-participant-container.command',
    'application/season-action-user.query',
    'public-targets/registration-snapshot.query',
  ])('rejects external implementation imports at %s', (target) => {
    expect(
      participantImportViolations(
        'matches/requests/consumer.ts',
        `import { implementation } from '../../season-participants/${target}.js';`,
      ),
    ).toHaveLength(1);
  });

  it.each([
    `export { implementation } from '../../season-participants/deregistration/deregister-season-participant.command.js';`,
    `const implementation = import('../../season-participants/lifecycle/backfill-current-season-participants.command.js');`,
    `const implementation = require('../../season-participants/registration/finalize-season-registration.command.js');`,
    `import implementation = require('../../season-participants/participants/season-participant-container.command.js');`,
    `type Implementation = import('../../season-participants/deregistration/deregister-season-participant.command.js').DeregisterSeasonParticipantCommand;`,
    `import { implementation } from '../../season-participants/policies/../registration/finalize-season-registration.command.js';`,
  ])('rejects alternate literal internal import forms: %s', (source) => {
    expect(participantImportViolations('matches/requests/consumer.ts', source)).toHaveLength(1);
  });

  it.each([
    'season-participants.module',
    'application/season-participants.service',
    'application/current-season-participation-view.query',
    'context/current-season-participant-context.guard',
    'capabilities/index',
    'policies/index',
    'public-target-policy/index',
    'lifestyle/lifestyle-persistence.mapper',
    'participants/season-participant-records',
  ])('preserves public surfaces and existing pure projections: %s', (target) => {
    expect(
      participantImportViolations(
        'matches/requests/consumer.ts',
        `import { publicSurface } from '../../season-participants/${target}.js';`,
      ),
    ).toEqual([]);
  });

  it('keeps public surfaces and the exact archive collaboration tied to existing source', () => {
    for (const [target, reason] of Object.entries(participantPublicSurfaces)) {
      expect(reason.length).toBeGreaterThan(0);
      expect(existsSync(join(seasonParticipantsRoot, `${target}.ts`)), target).toBe(true);
    }
    expect(existsSync(join(seasonParticipantsRoot, `${participantArchiveTarget}.ts`))).toBe(true);
    const registry = readSource(join(apiSourceRoot, participantArchiveCaller));
    // Removing the exception must expose the registry edge, rather than leave a stale allowance.
    expect(
      participantImportViolations('retention/archive-jobs/targets/other-handler.ts', registry),
    ).toContain(`season-participants/${participantArchiveTarget}`);
  });

  it('normalizes TS and extensionless paths without confusing a similarly named owner', () => {
    for (const extension of ['.ts', '']) {
      expect(
        participantImportViolations(
          'matches/consumer.ts',
          `import { command } from '../season-participants/registration/finalize-season-registration.command${extension}';`,
        ),
      ).toHaveLength(1);
    }
    expect(
      participantImportViolations(
        'matches/consumer.ts',
        `import { value } from '../season-participants-extra/registration/example.js';`,
      ),
    ).toEqual([]);
  });

  it('limits archive collaboration to the exact retention registry', () => {
    const source = `import { archiveSeasonProfileHistoryJob } from '../../../season-participants/retention/season-profile-history-archive.handler.js';`;
    expect(
      participantImportViolations(
        'retention/archive-jobs/targets/archive-target-handlers.ts',
        source,
      ),
    ).toEqual([]);
    expect(
      participantImportViolations('retention/archive-jobs/targets/other-handler.ts', source),
    ).toHaveLength(1);
  });

  it('preserves owner-internal imports and ignores comments or ordinary strings', () => {
    expect(
      participantImportViolations(
        'season-participants/application/owner.ts',
        `import { command } from '../deregistration/deregister-season-participant.command.js';`,
      ),
    ).toEqual([]);
    expect(
      participantImportViolations(
        'matches/consumer.ts',
        `// import { command } from '../season-participants/commands/example.js';\nconst note = "from '../season-participants/commands/example.js'";`,
      ),
    ).toEqual([]);
  });

  it('keeps SeasonParticipantsModule exports on the current public facade/context/view surface', () => {
    expect(moduleMetadata(SeasonParticipantsModule, 'exports')).toEqual([
      SeasonParticipantsService,
      CurrentSeasonParticipationViewQuery,
      CurrentSeasonParticipantContextGuard,
    ]);
  });

  it('keeps use-case deps file free of query helper implementation details after composition cleanup', () => {
    const depsSource = readSource(
      join(seasonParticipantsRoot, 'application/season-participant-use-case.deps.ts'),
    );

    expect(depsSource).toContain('export interface SeasonParticipantUseCaseDeps');
    expect(depsSource).toContain('export type DbClient');
    expect(depsSource).not.toContain('getVerifiedUserForSeasonAction');
    expect(depsSource).not.toContain('assertWritableSeasonContext');
    expect(depsSource).not.toContain('seasonContextSelect');
  });

  it('keeps SeasonParticipantsService as provider-injected facade instead of direct dependency assembler', () => {
    const serviceSource = readSource(
      join(seasonParticipantsRoot, 'application/season-participants.service.ts'),
    );

    expect(serviceSource).toContain('SEASON_PARTICIPANT_WRITE_OWNER');
    expect(serviceSource).toContain('SEASON_PARTICIPANT_PUBLIC_TARGET_OWNER');
    expect(serviceSource).toContain('SEASON_PARTICIPANT_SOURCE_OWNER');
    expect(serviceSource).not.toMatch(/private readonly prisma: PrismaService/);
    expect(serviceSource).not.toMatch(/private readonly seasonsService: SeasonContextPort/);
    expect(serviceSource).not.toMatch(/private readonly dormitorySelectionCatalog/);
    expect(serviceSource).not.toMatch(/createSeasonParticipantWriteOwner\(/);
  });

  it('keeps season-participants independent from concrete DormitoriesService internals', () => {
    const concreteDormitoriesServiceImport =
      /from\s+['"][^'"]*dormitories\/dormitories\.service(?:\.js)?['"]/;

    expect(filesContaining(seasonParticipantsRoot, concreteDormitoriesServiceImport)).toEqual([]);
  });

  it('keeps public target policy pure and capability/policy files pure', () => {
    const publicTargetPolicyFiles = productionTypeScriptFiles(
      join(seasonParticipantsRoot, 'public-target-policy'),
    )
      .map((path) => rootRelativePath(path, join(seasonParticipantsRoot, 'public-target-policy')))
      .sort();
    const publicTargetPolicySource = publicTargetPolicyFiles
      .map((file) => readSource(join(seasonParticipantsRoot, 'public-target-policy', file)))
      .join('\n');
    const removedRootPolicyImports = filesContaining(
      apiSourceRoot,
      /season-participants\/season-participant-policy(?:\.js)?/,
    );

    expect(publicTargetPolicyFiles.filter((file) => file.endsWith('.owner.ts'))).toEqual([]);
    expect(publicTargetPolicySource).not.toMatch(/PrismaService|from ['"][^'"]*public-targets\//);
    expect(
      existsSync(join(seasonParticipantsRoot, 'public-targets/registration-snapshot.query.ts')),
    ).toBe(true);
    expect(removedRootPolicyImports).toEqual([]);
  });

  it('keeps external domains on season-participants public policy/capability barrels', () => {
    const internalPolicySurfaceImport =
      /season-participants\/(?:capabilities|policies|public-target-policy)\/(?!index(?:\.js)?['"])[^'"]+/;
    const rootGateImport = /season-participants\/season-participant-gate-context(?:\.js)?/;
    const externalFiles = productionTypeScriptFiles(apiSourceRoot).filter(
      (path) => !path.startsWith(seasonParticipantsRoot),
    );
    const offenders = externalFiles
      .filter((path) => {
        const source = readSource(path);
        return internalPolicySurfaceImport.test(source) || rootGateImport.test(source);
      })
      .map(relativeSourcePath)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('keeps current-season participant context owned by the context slice', () => {
    const rootContextFiles = productionTypeScriptFiles(seasonParticipantsRoot)
      .filter((path) => dirname(path) === seasonParticipantsRoot)
      .map((path) => rootRelativePath(path, seasonParticipantsRoot))
      .filter((path) => path.startsWith('current-season-participant-context.'))
      .sort();
    const guardSource = readSource(
      join(seasonParticipantsRoot, 'context/current-season-participant-context.guard.ts'),
    );
    const resolverSource = readSource(
      join(seasonParticipantsRoot, 'context/current-season-participant-context.resolver.ts'),
    );

    expect(rootContextFiles).toEqual([]);
    expect(guardSource).not.toMatch(/PrismaService/);
    expect(guardSource).not.toMatch(/ensureCurrentSeasonParticipant/);
    expect(guardSource).toContain('CurrentSeasonParticipantContextResolver');
    expect(resolverSource).toMatch(/PrismaService/);
    expect(resolverSource).toMatch(/ensureCurrentSeasonParticipant/);
  });

  it('keeps platform domain-context primitive free of current-season-participant vocabulary', () => {
    const offenders = filesContaining(
      platformDomainContextRoot,
      /current-season-participant|CurrentSeasonParticipantContextRequirement/,
    );

    expect(offenders).toEqual([]);
  });
});
