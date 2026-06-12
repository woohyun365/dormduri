import { describe, expect, it } from 'vitest';
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
] as const;

const finalProfileContractFiles = [
  'contracts/profile-detail-entry-token.codec.ts',
  'contracts/profile-public-target-reader.port.ts',
  'contracts/public-profile.presenter.ts',
] as const;

const forbiddenProfileLayoutFiles = [
  'application/ports/profile-public-target-reader.port.ts',
  'application/ports/profile-detail-reader.port.ts',
  'contracts/profile-contract.spec.ts',
  'mappers/lifestyle-public.mapper.ts',
  'targets/public-profile-target-block-visibility.query.ts',
  'targets/public-profile-target.mapper.ts',
  'targets/public-profile-target.materializer.spec.ts',
  'test-support/public-profile.fixture.ts',
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

function walkFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(path);
    }
    return entry.isFile() ? [path] : [];
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

  it('keeps profiles contracts limited to API-local public surfaces', () => {
    const contractFiles = productionTypeScriptFiles(join(profilesRoot, 'contracts'))
      .map((path) => rootRelativePath(path, profilesRoot))
      .sort();

    expect({
      expectedGreenPhase: 'Phase 9-1 profiles final contract surface lock',
      contractFiles,
    }).toEqual({
      expectedGreenPhase: 'Phase 9-1 profiles final contract surface lock',
      contractFiles: [...finalProfileContractFiles].sort(),
    });
  });

  it('keeps obsolete profile target-layout placeholders out of the final tree', () => {
    const existingForbiddenFiles = walkTypeScriptFiles(profilesRoot)
      .map((path) => rootRelativePath(path, profilesRoot))
      .filter((path) => forbiddenProfileLayoutFiles.some((forbidden) => forbidden === path))
      .sort();

    expect({
      expectedGreenPhase: 'Phase 9-1 profiles target layout reconciliation',
      existingForbiddenFiles,
    }).toEqual({
      expectedGreenPhase: 'Phase 9-1 profiles target layout reconciliation',
      existingForbiddenFiles: [],
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

  it('keeps profiles documentation centralized in the root README', () => {
    const childReadmes = walkFiles(profilesRoot)
      .map((path) => rootRelativePath(path, profilesRoot))
      .filter((path) => path !== 'README.md' && path.endsWith('/README.md'))
      .sort();

    expect({
      expectedGreenPhase: 'Phase 9-1 profiles root README only',
      childReadmes,
    }).toEqual({
      expectedGreenPhase: 'Phase 9-1 profiles root README only',
      childReadmes: [],
    });
  });
});
