import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const appModulePath = join(apiSourceRoot, 'app.module.ts');
const profilesRoot = join(apiSourceRoot, 'profiles');
const profilesModulePath = join(profilesRoot, 'profiles.module.ts');
const roommateSearchRoot = join(apiSourceRoot, 'roommate-search');

const finalRoommateSearchDirectories = [
  'application',
  'candidates',
  'composition',
  'contracts',
  'errors',
  'filters',
  'integration',
  'manifest',
  'pagination',
  'presentation',
  'scope',
  'sorting',
  'test-support',
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

describe('roommate-search final structure boundary', () => {
  it('keeps roommate-search as a top-level module with final slices', () => {
    const rootProductionFiles = productionTypeScriptFiles(roommateSearchRoot)
      .filter((path) => dirname(path) === roommateSearchRoot)
      .map((path) => rootRelativePath(path, roommateSearchRoot))
      .sort();
    const missingFinalDirectories = finalRoommateSearchDirectories.filter(
      (directory) => !existsSync(join(roommateSearchRoot, directory)),
    );

    expect({
      expectedGreenPhase: 'Phase 3 roommate-search top-level extraction',
      hasRoommateSearchRoot: existsSync(roommateSearchRoot),
      rootProductionFiles,
      missingFinalDirectories,
    }).toEqual({
      expectedGreenPhase: 'Phase 3 roommate-search top-level extraction',
      hasRoommateSearchRoot: true,
      rootProductionFiles: ['roommate-search.controller.ts', 'roommate-search.module.ts'],
      missingFinalDirectories: [],
    });
  });

  it('keeps roommate-search production files out of profiles root after extraction', () => {
    const remainingProfilesRoommateSearchFiles = readdirSync(profilesRoot)
      .filter(
        (file) =>
          file.endsWith('.ts') &&
          !file.endsWith('.spec.ts') &&
          (file.startsWith('roommate-search') || file === 'roommate-search.errors.ts'),
      )
      .sort();

    expect({
      expectedGreenPhase: 'Phase 3 roommate-search extraction from profiles root',
      remainingProfilesRoommateSearchFiles,
    }).toEqual({
      expectedGreenPhase: 'Phase 3 roommate-search extraction from profiles root',
      remainingProfilesRoommateSearchFiles: [],
    });
  });

  it('keeps module ownership split without importing future module classes in this guard', () => {
    const appModuleSource = readSource(appModulePath);
    const profilesModuleSource = readSource(profilesModulePath);

    expect({
      expectedGreenPhase: 'Phase 3 ProfilesModule / RoommateSearchModule split',
      appImportsRoommateSearchModule: appModuleSource.includes('RoommateSearchModule'),
      profilesModuleOwnsRoommateSearch: /RoommateSearchController|RoommateSearchService/.test(
        profilesModuleSource,
      ),
    }).toEqual({
      expectedGreenPhase: 'Phase 3 ProfilesModule / RoommateSearchModule split',
      appImportsRoommateSearchModule: true,
      profilesModuleOwnsRoommateSearch: false,
    });
  });

  it('keeps roommate-search away from direct bookmark/block table authority', () => {
    const sourcesToInspect = [
      ...productionTypeScriptFiles(roommateSearchRoot),
      ...productionTypeScriptFiles(profilesRoot).filter((path) =>
        rootRelativePath(path, profilesRoot).startsWith('roommate-search'),
      ),
    ];
    const directSocialSafetyTableReaders = sourcesToInspect
      .filter((path) => /prisma\.(userBookmark|userBlock)\b/.test(readSource(path)))
      .map((path) => relative(apiRoot, path).split(sep).join('/'))
      .sort();

    expect({
      expectedGreenPhase: 'Phase 4 social-safety bookmark/block read port cleanup',
      directSocialSafetyTableReaders,
    }).toEqual({
      expectedGreenPhase: 'Phase 4 social-safety bookmark/block read port cleanup',
      directSocialSafetyTableReaders: [],
    });
  });

  it('keeps legacy owner symbols out of roommate-search production code', () => {
    const ownerSymbolOffenders = productionTypeScriptFiles(roommateSearchRoot)
      .filter((path) => /Owner|owner/.test(readSource(path)))
      .map((path) => rootRelativePath(path, roommateSearchRoot))
      .sort();

    expect({
      expectedGreenPhase: 'Phase 6 roommate-search owner symbol cleanup',
      ownerSymbolOffenders,
    }).toEqual({
      expectedGreenPhase: 'Phase 6 roommate-search owner symbol cleanup',
      ownerSymbolOffenders: [],
    });
  });
});
