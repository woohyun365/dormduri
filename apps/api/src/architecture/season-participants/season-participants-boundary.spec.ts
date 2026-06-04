import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';
import { CurrentSeasonParticipantContextGuard } from '../../season-participants/current-season-participant-context.guard.js';
import { CurrentSeasonParticipationViewOwner } from '../../season-participants/current-season-participation-view.owner.js';
import { SeasonParticipantsModule } from '../../season-participants/season-participants.module.js';
import { SeasonParticipantsService } from '../../season-participants/season-participants.service.js';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const seasonParticipantsRoot = join(apiSourceRoot, 'season-participants');
const platformDomainContextRoot = join(apiSourceRoot, 'platform/domain-context');

const transitionalRootOwnerFiles = [
  'current-season-participation-view.owner.ts',
  'dormitory-selection.owner.ts',
  'season-participant-backfill.owner.ts',
  'season-participant-container.owner.ts',
  'season-participant-deregistration.owner.ts',
  'season-participant-public-target.owner.ts',
  'season-participation-capability.owner.ts',
  'season-profile-draft.owner.ts',
  'season-registration-finalize.owner.ts',
] as const;

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
  it('locks current root owner files so Phase 2~8 can only delete or move them deliberately', () => {
    const rootOwnerFiles = productionTypeScriptFiles(seasonParticipantsRoot)
      .filter(
        (path) => dirname(path) === seasonParticipantsRoot && basename(path).endsWith('.owner.ts'),
      )
      .map((path) => rootRelativePath(path, seasonParticipantsRoot))
      .sort();

    expect(rootOwnerFiles).toEqual([...transitionalRootOwnerFiles].sort());
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
