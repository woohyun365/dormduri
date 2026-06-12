import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { AuthModule } from '../../auth/auth.module.js';
import { DormitoriesModule } from '../../dormitories/dormitories.module.js';
import { dirname, join, relative, sep } from 'node:path';
import { CurrentSeasonParticipantContextGuard } from '../../season-participants/context/current-season-participant-context.guard.js';
import {
  CurrentSeasonParticipationController,
  CurrentSeasonProfileController,
} from '../../season-participants/current-season-participation.controller.js';
import { CurrentSeasonParticipationViewQuery } from '../../season-participants/application/current-season-participation-view.query.js';
import { SeasonParticipantsModule } from '../../season-participants/season-participants.module.js';
import { SEASON_PARTICIPANTS_EXPORTS } from '../../season-participants/composition/season-participants.exports.js';
import { SEASON_PARTICIPANTS_PROVIDERS } from '../../season-participants/composition/season-participants.providers.js';
import { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import { UsersModule } from '../../users/users.module.js';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const seasonParticipantsRoot = join(apiSourceRoot, 'season-participants');
const platformDomainContextRoot = join(apiSourceRoot, 'platform/domain-context');

const allowedRootSpecFiles = ['current-season-participation.controller.spec.ts'] as const;

const finalizingPhaseTwoDirectories = [
  'application',
  'capabilities',
  'composition',
  'context',
  'deregistration',
  'dormitory-selection',
  'errors',
  'lifecycle',
  'participants',
  'policies',
  'profile-draft',
  'public-target-policy',
  'public-targets',
  'registration',
] as const;

const requiredPhaseTwoOneFiles = {
  application: [
    'season-action-user.query.ts',
    'season-context.query.ts',
    'season-participant-use-case.tokens.ts',
    'season-participant-write-owner.ts',
    'current-season-participation-view.query.ts',
    'season-participant-use-case.deps.ts',
    'season-participants.service.ts',
  ],
  composition: ['season-participants.exports.ts', 'season-participants.providers.ts'],
  capabilities: [
    'current-user-capability-input.mapper.ts',
    'current-user-capabilities.policy.ts',
    'index.ts',
    'season-participation-capability.mapper.ts',
    'season-participation-capability.policy.ts',
  ],
  context: [
    'current-season-participant-context.decorator.ts',
    'current-season-participant-context.guard.ts',
    'current-season-participant-context.resolver.ts',
    'current-season-participant-context-requirement.ts',
    'current-season-participant-context.types.ts',
    'index.ts',
  ],
  deregistration: ['deregister-season-participant.command.ts', 'season-deregistration.policy.ts'],
  'dormitory-selection': [
    'dormitory-selection-readiness.evaluator.ts',
    'dormitory-selection.mapper.ts',
    'dormitory-selection.policy.ts',
    'list-current-season-selectable-dormitories.query.ts',
    'update-dormitory-selection.command.ts',
  ],
  errors: ['season-participants.errors.ts'],
  lifecycle: [
    'backfill-current-season-participants.command.ts',
    'season-participant-lifecycle-event.repository.ts',
    'season-participant-lifecycle-event.types.ts',
    'season-participant-lifecycle-event.writer.ts',
  ],
  participants: [
    'season-participant-container.command.ts',
    'season-participant-records.ts',
    'season-participant-source.policy.ts',
  ],
  policies: [
    'index.ts',
    'season-participant-selection.policy.ts',
    'season-participant-status.policy.ts',
  ],
  'profile-draft': [
    'get-current-season-profile.query.ts',
    'season-profile-completeness.policy.ts',
    'season-profile-draft.mapper.ts',
    'upsert-season-profile-draft.command.ts',
  ],
  'public-target-policy': [
    'index.ts',
    'public-profile-exposure.policy.ts',
    'public-result-read.policy.ts',
    'public-target-action.policy.ts',
    'public-target-eligibility.policy.ts',
    'public-target-policy.ts',
    'public-target-policy-input.mapper.ts',
    'public-target-policy.types.ts',
    'public-target-relation.policy.ts',
  ],
  'public-targets': ['registration-snapshot.query.ts'],
  registration: [
    'finalize-season-registration.command.ts',
    'season-registration-history.mapper.ts',
    'season-registration-readiness.evaluator.ts',
    'season-registration.policy.ts',
  ],
} as const;

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

function expectReadmeSections(path: string, sections: readonly string[]) {
  expect(existsSync(path)).toBe(true);
  const source = readSource(path);

  for (const section of sections) {
    expect(source).toContain(section);
  }

  return source;
}

describe('season-participants final structure boundary', () => {
  it('keeps Phase 2-1 finalized slice directories and files out of the root', () => {
    for (const directory of finalizingPhaseTwoDirectories) {
      expect(existsSync(join(seasonParticipantsRoot, directory))).toBe(true);
    }

    for (const [directory, files] of Object.entries(requiredPhaseTwoOneFiles)) {
      for (const file of files) {
        expect(existsSync(join(seasonParticipantsRoot, directory, file))).toBe(true);
      }
    }

    const forbiddenRootFiles = [
      'season-participants.service.ts',
      'season-participants.errors.ts',
      'season-participant-container.owner.ts',
      'season-participant-public-target.owner.ts',
      'season-participant-records.ts',
      'season-participant-source-owner.ts',
      'season-participant-write-owner.ts',
      'season-profile-draft.owner.ts',
      'dormitory-selection.owner.ts',
      'season-registration-finalize.owner.ts',
      'season-participant-deregistration.owner.ts',
      'season-participant-policy.ts',
      'season-participant-status.ts',
      'season-participant-selection.ts',
      'season-participant-capabilities.ts',
      'season-participation-capability.owner.ts',
      'season-participant-gate-context.ts',
      'season-participant-gate-inputs.ts',
    ] as const;

    for (const file of forbiddenRootFiles) {
      expect(existsSync(join(seasonParticipantsRoot, file))).toBe(false);
    }
  });

  it('keeps root production files free of legacy owner/deps compatibility files', () => {
    const rootProductionFiles = productionTypeScriptFiles(seasonParticipantsRoot)
      .filter((path) => dirname(path) === seasonParticipantsRoot)
      .map((path) => rootRelativePath(path, seasonParticipantsRoot))
      .sort();

    expect(rootProductionFiles).toEqual([
      'current-season-participation.controller.ts',
      'season-participants.module.ts',
    ]);
  });

  it('keeps root spec surface limited to controller specs after final cleanup', () => {
    const rootSpecFiles = walkTypeScriptFiles(seasonParticipantsRoot)
      .filter((path) => dirname(path) === seasonParticipantsRoot && path.endsWith('.spec.ts'))
      .map((path) => rootRelativePath(path, seasonParticipantsRoot))
      .sort();

    expect(rootSpecFiles).toEqual([...allowedRootSpecFiles].sort());
  });

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

  it('keeps external domains from importing planned season-participants commands/queries/repositories internals', () => {
    const forbiddenInternalImport =
      /from\s+['"][^'"]*season-participants\/(?:commands|queries|repositories)(?:\/|['"])/;
    const externalFiles = productionTypeScriptFiles(apiSourceRoot).filter(
      (path) => !path.startsWith(seasonParticipantsRoot),
    );
    const offenders = externalFiles
      .filter((path) => forbiddenInternalImport.test(readSource(path)))
      .map(relativeSourcePath)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('keeps SeasonParticipantsModule composition arrays as the provider/export source of truth', () => {
    const moduleSource = readSource(join(seasonParticipantsRoot, 'season-participants.module.ts'));

    expect(moduleSource).toContain('SEASON_PARTICIPANTS_PROVIDERS');
    expect(moduleSource).toContain('SEASON_PARTICIPANTS_EXPORTS');
    expect(moduleSource).not.toContain('useFactory:');
    expect(moduleMetadata(SeasonParticipantsModule, 'providers')).toEqual(
      SEASON_PARTICIPANTS_PROVIDERS,
    );
    expect(moduleMetadata(SeasonParticipantsModule, 'exports')).toEqual(
      SEASON_PARTICIPANTS_EXPORTS,
    );
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

  it('keeps public target policy pure and capability/policy files in final slices', () => {
    const publicTargetPolicyFiles = productionTypeScriptFiles(
      join(seasonParticipantsRoot, 'public-target-policy'),
    )
      .map((path) => rootRelativePath(path, join(seasonParticipantsRoot, 'public-target-policy')))
      .sort();
    const publicTargetPolicySource = publicTargetPolicyFiles
      .map((file) => readSource(join(seasonParticipantsRoot, 'public-target-policy', file)))
      .join('\n');
    const legacyRootPolicyImports = filesContaining(
      apiSourceRoot,
      /season-participants\/season-participant-policy(?:\.js)?/,
    );

    expect(publicTargetPolicyFiles.filter((file) => file.endsWith('.owner.ts'))).toEqual([]);
    expect(publicTargetPolicySource).not.toMatch(/PrismaService|from ['"][^'"]*public-targets\//);
    expect(
      existsSync(join(seasonParticipantsRoot, 'public-targets/registration-snapshot.query.ts')),
    ).toBe(true);
    expect(legacyRootPolicyImports).toEqual([]);
  });

  it('keeps Phase 8-A mapper/spec boundaries out of root compatibility files', () => {
    const rootGateFiles = walkTypeScriptFiles(seasonParticipantsRoot)
      .filter((path) => dirname(path) === seasonParticipantsRoot)
      .map((path) => rootRelativePath(path, seasonParticipantsRoot))
      .filter((path) => path.startsWith('season-participant-gate'))
      .sort();
    const rootPolicySpecs = walkTypeScriptFiles(seasonParticipantsRoot)
      .filter((path) => dirname(path) === seasonParticipantsRoot)
      .map((path) => rootRelativePath(path, seasonParticipantsRoot))
      .filter((path) =>
        ['season-participant-policy.spec.ts', 'season-participant-gate-context.spec.ts'].includes(
          path,
        ),
      )
      .sort();
    const requiredSpecFiles = [
      'capabilities/current-user-capabilities.policy.spec.ts',
      'capabilities/current-user-capability-input.mapper.spec.ts',
      'policies/season-participant-selection.policy.spec.ts',
      'public-target-policy/public-profile-exposure.policy.spec.ts',
      'public-target-policy/public-result-read.policy.spec.ts',
      'public-target-policy/public-target-action.policy.spec.ts',
      'public-target-policy/public-target-eligibility.policy.spec.ts',
      'public-target-policy/public-target-policy-input.mapper.spec.ts',
      'public-target-policy/public-target-policy.spec.ts',
      'public-target-policy/public-target-relation.policy.spec.ts',
    ] as const;

    expect(rootGateFiles).toEqual([]);
    expect(rootPolicySpecs).toEqual([]);
    for (const file of requiredSpecFiles) {
      expect(existsSync(join(seasonParticipantsRoot, file))).toBe(true);
    }
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

  it('documents the final season-participants product boundary', () => {
    const source = expectReadmeSections(join(seasonParticipantsRoot, 'README.md'), [
      '## Public boundary',
      '## Directory responsibilities',
      '## Hard rules',
      '## Architecture guard',
      '## Where to change',
      '## Useful verification',
    ]);

    expect(source).toContain('CurrentSeasonParticipationViewQuery');
    expect(source).toContain('Root production TypeScript file은 controller/module만 허용한다');
    expect(source).toContain('SeasonParticipantLifecycleEvent`는 audit/debug trace');
    expect(source).toContain('test-support/`');
  });

  it('keeps platform domain-context primitive free of current-season-participant vocabulary', () => {
    const offenders = filesContaining(
      platformDomainContextRoot,
      /current-season-participant|CurrentSeasonParticipantContextRequirement/,
    );

    expect(offenders).toEqual([]);
  });
});
