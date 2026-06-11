import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const profilesRoot = join(apiSourceRoot, 'profiles');

const finalProfileDirectories = [
  'application',
  'composition',
  'contracts',
  'details',
  'errors',
  'mappers',
  'targets',
  'test-support',
] as const;

const requiredReadmeSections = [
  '## Public boundary',
  '## Directory responsibilities',
  '## Hard rules',
  '## Architecture guard',
  '## Where to change profile behavior',
  '## Useful verification',
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

function rootRelativePath(path: string, root: string) {
  return relative(root, path).split(sep).join('/');
}

function apiRelativePath(path: string) {
  return relative(apiRoot, path).split(sep).join('/');
}

describe('profiles final structure boundary', () => {
  it('keeps profiles root production surface limited to controller and module', () => {
    const rootProductionFiles = productionTypeScriptFiles(profilesRoot)
      .filter((path) => dirname(path) === profilesRoot)
      .map((path) => rootRelativePath(path, profilesRoot))
      .sort();

    expect({
      expectedGreenPhase: 'Phase 2/6 profiles root cleanup',
      rootProductionFiles,
    }).toEqual({
      expectedGreenPhase: 'Phase 2/6 profiles root cleanup',
      rootProductionFiles: ['profiles.controller.ts', 'profiles.module.ts'],
    });
  });

  it('keeps profiles root spec surface limited to controller behavior', () => {
    const rootSpecFiles = walkTypeScriptFiles(profilesRoot)
      .filter((path) => dirname(path) === profilesRoot && path.endsWith('.spec.ts'))
      .map((path) => rootRelativePath(path, profilesRoot))
      .sort();

    expect({
      expectedGreenPhase: 'Phase 2/6 profiles spec relocation',
      rootSpecFiles,
    }).toEqual({
      expectedGreenPhase: 'Phase 2/6 profiles spec relocation',
      rootSpecFiles: ['profiles.controller.spec.ts'],
    });
  });

  it('keeps legacy owner-suffix production files out of profiles', () => {
    const ownerFiles = productionTypeScriptFiles(profilesRoot)
      .filter((path) => /(^|[-.])owner([-.]|$)/.test(rootRelativePath(path, profilesRoot)))
      .map((path) => rootRelativePath(path, profilesRoot))
      .sort();

    expect({
      expectedGreenPhase: 'Phase 2/6 profiles owner suffix cleanup',
      ownerFiles,
    }).toEqual({
      expectedGreenPhase: 'Phase 2/6 profiles owner suffix cleanup',
      ownerFiles: [],
    });
  });

  it('keeps legacy owner symbols out of profiles production code', () => {
    const ownerSymbolOffenders = productionTypeScriptFiles(profilesRoot)
      .filter((path) => /Owner|owner/.test(readSource(path)))
      .map((path) => rootRelativePath(path, profilesRoot))
      .sort();

    expect({
      expectedGreenPhase: 'Phase 6 profiles owner symbol cleanup',
      ownerSymbolOffenders,
    }).toEqual({
      expectedGreenPhase: 'Phase 6 profiles owner symbol cleanup',
      ownerSymbolOffenders: [],
    });
  });

  it('keeps final profile detail slice directories present', () => {
    const missingFinalDirectories = finalProfileDirectories.filter(
      (directory) => !existsSync(join(profilesRoot, directory)),
    );

    expect({
      expectedGreenPhase: 'Phase 2 profiles detail/materialization nested split',
      missingFinalDirectories,
    }).toEqual({
      expectedGreenPhase: 'Phase 2 profiles detail/materialization nested split',
      missingFinalDirectories: [],
    });
  });

  it('keeps external production code away from profile detail internals', () => {
    const forbiddenImportOffenders = productionTypeScriptFiles(apiSourceRoot)
      .filter((path) => !path.startsWith(profilesRoot))
      .filter((path) => /from\s+['"].*profiles\/(details|targets|mappers)\//.test(readSource(path)))
      .map(apiRelativePath)
      .sort();

    expect(forbiddenImportOffenders).toEqual([]);
  });

  it('keeps profiles away from direct social-safety relation table authority', () => {
    const directSocialSafetyTableReaders = productionTypeScriptFiles(profilesRoot)
      .filter((path) => /prisma\.(userBookmark|userBlock)\b/.test(readSource(path)))
      .map(apiRelativePath)
      .sort();

    expect({
      expectedGreenPhase: 'Phase 4 social-safety bookmark/block read port cleanup',
      directSocialSafetyTableReaders,
    }).toEqual({
      expectedGreenPhase: 'Phase 4 social-safety bookmark/block read port cleanup',
      directSocialSafetyTableReaders: [],
    });
  });

  it('documents profiles as a product boundary map', () => {
    const readmePath = join(profilesRoot, 'README.md');
    const source = readSource(readmePath);

    expect(existsSync(readmePath)).toBe(true);
    for (const section of requiredReadmeSections) {
      expect(source).toContain(section);
    }
    expect(source).toContain('profile detail/read projection');
    expect(source).toContain('roommate-search');
    expect(source).toContain('SeasonParticipantProfile');
  });
});
