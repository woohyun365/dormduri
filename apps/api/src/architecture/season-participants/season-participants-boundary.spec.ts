import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { CurrentSeasonParticipantContextGuard } from '../../season-participants/current-season-participant-context.guard.js';
import { CurrentSeasonParticipationViewOwner } from '../../season-participants/current-season-participation-view.owner.js';
import { SeasonParticipantsModule } from '../../season-participants/season-participants.module.js';
import { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const seasonParticipantsRoot = join(apiSourceRoot, 'season-participants');
const platformDomainContextRoot = join(apiSourceRoot, 'platform/domain-context');

const transitionalRootOwnerFiles = [
  'current-season-participation-view.owner.ts',
  'season-participant-backfill.owner.ts',
  'season-participation-capability.owner.ts',
] as const;

const finalizingPhaseTwoDirectories = [
  'application',
  'deregistration',
  'dormitory-selection',
  'errors',
  'lifecycle',
  'participants',
  'profile-draft',
  'public-targets',
  'registration',
] as const;

const requiredPhaseTwoOneFiles = {
  application: [
    'season-participant-use-case.tokens.ts',
    'season-participant-write-owner.ts',
    'season-participants.service.ts',
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
    'season-participant-lifecycle-event.repository.ts',
    'season-participant-lifecycle-event.types.ts',
    'season-participant-lifecycle-event.writer.ts',
  ],
  participants: [
    'season-participant-container.command.ts',
    'season-participant-records.ts',
    'season-participant-source.policy.ts',
  ],
  'profile-draft': [
    'get-current-season-profile.query.ts',
    'season-profile-completeness.policy.ts',
    'season-profile-draft.mapper.ts',
    'upsert-season-profile-draft.command.ts',
  ],
  'public-targets': ['registration-snapshot.query.ts'],
  registration: [
    'finalize-season-registration.command.ts',
    'season-registration-history.mapper.ts',
    'season-registration-readiness.evaluator.ts',
    'season-registration.policy.ts',
  ],
} as const;

const transitionalRootContextFiles = [
  'current-season-participant-context.decorator.ts',
  'current-season-participant-context.guard.ts',
  'current-season-participant-context.types.ts',
] as const;

function moduleMetadata<T>(target: object, key: 'imports' | 'exports'): T[] {
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
    ] as const;

    for (const file of forbiddenRootFiles) {
      expect(existsSync(join(seasonParticipantsRoot, file))).toBe(false);
    }
  });

  it('locks current root owner files so Phase 2~8 can only delete or move them deliberately', () => {
    const rootOwnerFiles = productionTypeScriptFiles(seasonParticipantsRoot)
      .filter(
        (path) => dirname(path) === seasonParticipantsRoot && basename(path).endsWith('.owner.ts'),
      )
      .map((path) => rootRelativePath(path, seasonParticipantsRoot))
      .sort();

    expect(rootOwnerFiles).toEqual([...transitionalRootOwnerFiles].sort());
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
      join(seasonParticipantsRoot, 'season-participant-backfill.owner.ts'),
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

  it('keeps SeasonParticipantsModule exports on the current public facade/context/view surface', () => {
    expect(moduleMetadata(SeasonParticipantsModule, 'exports')).toEqual([
      SeasonParticipantsService,
      CurrentSeasonParticipationViewOwner,
      CurrentSeasonParticipantContextGuard,
    ]);
  });

  it('keeps SeasonParticipantsService as provider-injected facade instead of direct dependency assembler', () => {
    const serviceSource = readSource(
      join(seasonParticipantsRoot, 'application/season-participants.service.ts'),
    );

    expect(serviceSource).toContain('SEASON_PARTICIPANT_WRITE_OWNER');
    expect(serviceSource).toContain('SEASON_PARTICIPANT_PUBLIC_TARGET_OWNER');
    expect(serviceSource).toContain('SEASON_PARTICIPANT_SOURCE_OWNER');
    expect(serviceSource).not.toMatch(/private readonly prisma: PrismaService/);
    expect(serviceSource).not.toMatch(/private readonly seasonsService: SeasonsService/);
    expect(serviceSource).not.toMatch(/private readonly dormitorySelectionCatalog/);
    expect(serviceSource).not.toMatch(/createSeasonParticipantWriteOwner\(/);
  });

  it('keeps season-participants independent from concrete DormitoriesService internals', () => {
    const concreteDormitoriesServiceImport =
      /from\s+['"][^'"]*dormitories\/dormitories\.service(?:\.js)?['"]/;

    expect(filesContaining(seasonParticipantsRoot, concreteDormitoriesServiceImport)).toEqual([]);
  });

  it('keeps current-season participant context migration debt explicit until Phase 7 owner finalization', () => {
    const rootContextFiles = productionTypeScriptFiles(seasonParticipantsRoot)
      .filter((path) => dirname(path) === seasonParticipantsRoot)
      .map((path) => rootRelativePath(path, seasonParticipantsRoot))
      .filter((path) => path.startsWith('current-season-participant-context.'))
      .sort();

    expect(rootContextFiles).toEqual([...transitionalRootContextFiles].sort());
    expect(
      existsSync(
        join(seasonParticipantsRoot, 'context/current-season-participant-context-requirement.ts'),
      ),
    ).toBe(true);
  });

  it('keeps platform domain-context primitive free of current-season-participant vocabulary', () => {
    const offenders = filesContaining(
      platformDomainContextRoot,
      /current-season-participant|CurrentSeasonParticipantContextRequirement/,
    );

    expect(offenders).toEqual([]);
  });
});
