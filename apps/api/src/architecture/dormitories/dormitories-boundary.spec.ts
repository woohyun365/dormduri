import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { DormitoriesModule } from '../../dormitories/dormitories.module.js';
import { DormitoriesService } from '../../dormitories/dormitories.service.js';
import { DORMITORY_SELECTION_CATALOG_PORT } from '../../dormitories/selection-catalog/dormitory-selection-catalog.port.js';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const dormitoriesRoot = join(apiSourceRoot, 'dormitories');
const seasonParticipantsRoot = join(apiSourceRoot, 'season-participants');

const finalRootRuntimeFiles = [
  'dormitories.controller.ts',
  'dormitories.errors.ts',
  'dormitories.module.ts',
  'dormitories.service.ts',
] as const;

const requiredFinalDirectories = ['catalog', 'guides', 'selection-catalog'] as const;

const requiredPhaseOneSliceFiles = {
  catalog: [
    'dormitory-catalog.mapper.ts',
    'dormitory-catalog.query.ts',
    'dormitory-catalog.repository.ts',
  ],
  guides: ['dormitory-guide.mapper.ts', 'dormitory-guide.query.ts'],
  'selection-catalog': [
    'dormitory-selection-catalog.mapper.ts',
    'dormitory-selection-catalog.port.ts',
    'dormitory-selection-eligibility.policy.ts',
    'prisma-dormitory-selection-catalog.adapter.ts',
  ],
} as const;

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

describe('dormitories final structure boundary', () => {
  it('keeps dormitories independent from season-participants imports', () => {
    const forbiddenSeasonParticipantImport = /from\s+['"][^'"]*season-participants(?:\/|['"])/;

    expect(filesContaining(dormitoriesRoot, forbiddenSeasonParticipantImport)).toEqual([]);
    expect(existsSync(seasonParticipantsRoot)).toBe(true);
  });

  it('keeps root runtime files thin after catalog/guide/selection-catalog split', () => {
    const rootRuntimeFiles = productionTypeScriptFiles(dormitoriesRoot)
      .map((path) => rootRelativePath(path, dormitoriesRoot))
      .filter((path) => !path.includes('/'))
      .sort();

    expect(rootRuntimeFiles).toEqual([...finalRootRuntimeFiles].sort());

    for (const directory of requiredFinalDirectories) {
      expect(existsSync(join(dormitoriesRoot, directory))).toBe(true);
    }
  });

  it('keeps Phase 1 dormitories slice files aligned with final naming rules', () => {
    for (const [directory, files] of Object.entries(requiredPhaseOneSliceFiles)) {
      for (const file of files) {
        expect(existsSync(join(dormitoriesRoot, directory, file))).toBe(true);
      }
    }
  });

  it('keeps root owner-style files out of dormitories', () => {
    const rootOwnerFiles = productionTypeScriptFiles(dormitoriesRoot)
      .map((path) => rootRelativePath(path, dormitoriesRoot))
      .filter((path) => !path.includes('/') && path.endsWith('.owner.ts'))
      .sort();

    expect(rootOwnerFiles).toEqual([]);
  });

  it('keeps DormitoriesModule exports limited to the public facade and selection catalog port', () => {
    expect(moduleMetadata(DormitoriesModule, 'exports')).toEqual([
      DormitoriesService,
      DORMITORY_SELECTION_CATALOG_PORT,
    ]);
  });
});
