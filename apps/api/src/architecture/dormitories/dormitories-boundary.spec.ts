import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { DormitoriesModule } from '../../dormitories/dormitories.module.js';
import { DORMITORIES_EXPORTS } from '../../dormitories/composition/dormitories.exports.js';
import { DORMITORIES_PROVIDERS } from '../../dormitories/composition/dormitories.providers.js';
import { DormitoriesService } from '../../dormitories/application/dormitories.service.js';
import { DORMITORY_SELECTION_CATALOG_PORT } from '../../dormitories/selection-catalog/dormitory-selection-catalog.port.js';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const dormitoriesRoot = join(apiSourceRoot, 'dormitories');
const seasonParticipantsRoot = join(apiSourceRoot, 'season-participants');

const finalRootRuntimeFiles = ['dormitories.controller.ts', 'dormitories.module.ts'] as const;

const requiredFinalDirectories = [
  'application',
  'catalog',
  'composition',
  'errors',
  'guides',
  'selection-catalog',
] as const;

const requiredPhaseOneSliceFiles = {
  application: ['dormitories.service.ts'],
  composition: ['dormitories.exports.ts', 'dormitories.providers.ts'],
  catalog: [
    'dormitory-catalog.mapper.ts',
    'dormitory-catalog.query.ts',
    'dormitory-catalog.repository.ts',
  ],
  errors: ['dormitories.errors.ts'],
  guides: ['dormitory-guide.mapper.ts', 'dormitory-guide.query.ts'],
  'selection-catalog': [
    'dormitory-selection-catalog.mapper.ts',
    'dormitory-selection-catalog.port.ts',
    'dormitory-selection-eligibility.policy.ts',
    'prisma-dormitory-selection-catalog.adapter.ts',
  ],
} as const;

function moduleMetadata<T>(target: object, key: 'imports' | 'providers' | 'exports'): T[] {
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

  it('keeps DormitoriesModule composition arrays as the provider/export source of truth', () => {
    const moduleSource = readSource(join(dormitoriesRoot, 'dormitories.module.ts'));

    expect(moduleSource).toContain('DORMITORIES_PROVIDERS');
    expect(moduleSource).toContain('DORMITORIES_EXPORTS');
    expect(moduleSource).not.toContain('useExisting: PrismaDormitorySelectionCatalogAdapter');
    expect(moduleMetadata(DormitoriesModule, 'providers')).toEqual(DORMITORIES_PROVIDERS);
    expect(moduleMetadata(DormitoriesModule, 'exports')).toEqual(DORMITORIES_EXPORTS);
  });

  it('keeps DormitoriesModule exports limited to the public facade and selection catalog port', () => {
    expect(moduleMetadata(DormitoriesModule, 'exports')).toEqual([
      DormitoriesService,
      DORMITORY_SELECTION_CATALOG_PORT,
    ]);
  });

  it('documents the final dormitories product boundary', () => {
    const source = expectReadmeSections(join(dormitoriesRoot, 'README.md'), [
      '## Public boundary',
      '## Directory responsibilities',
      '## Hard rules',
      '## Architecture guard',
      '## Where to change',
      '## Useful verification',
    ]);

    expect(source).toContain('DORMITORY_SELECTION_CATALOG_PORT');
    expect(source).toContain(
      'Root production TypeScript file은 `dormitories.controller.ts`, `dormitories.module.ts`만 허용한다',
    );
    expect(source).toContain(
      'concrete `DormitoriesService`가 아니라 `DORMITORY_SELECTION_CATALOG_PORT`만 사용한다',
    );
  });
});
