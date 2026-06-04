import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { DormitoriesModule } from '../../dormitories/dormitories.module.js';
import { DormitoriesService } from '../../dormitories/dormitories.service.js';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const dormitoriesRoot = join(apiSourceRoot, 'dormitories');
const seasonParticipantsRoot = join(apiSourceRoot, 'season-participants');

const transitionalRootRuntimeFiles = [
  'dormitories.controller.ts',
  'dormitories.errors.ts',
  'dormitories.module.ts',
  'dormitories.service.ts',
  'dormitory-guide.mapper.ts',
  'dormitory-selectable-query.service.ts',
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

describe('dormitories final structure boundary', () => {
  it('keeps dormitories independent from season-participants imports', () => {
    const forbiddenSeasonParticipantImport = /from\s+['"][^'"]*season-participants(?:\/|['"])/;

    expect(filesContaining(dormitoriesRoot, forbiddenSeasonParticipantImport)).toEqual([]);
    expect(existsSync(seasonParticipantsRoot)).toBe(true);
  });

  it('locks current root runtime files until Phase 1 splits catalog/guide/selection-catalog', () => {
    const rootRuntimeFiles = productionTypeScriptFiles(dormitoriesRoot)
      .map((path) => rootRelativePath(path, dormitoriesRoot))
      .filter((path) => !path.includes('/'))
      .sort();

    expect(rootRuntimeFiles).toEqual([...transitionalRootRuntimeFiles].sort());
  });

  it('keeps root owner-style files out of dormitories', () => {
    const rootOwnerFiles = productionTypeScriptFiles(dormitoriesRoot)
      .map((path) => rootRelativePath(path, dormitoriesRoot))
      .filter((path) => !path.includes('/') && path.endsWith('.owner.ts'))
      .sort();

    expect(rootOwnerFiles).toEqual([]);
  });

  it('keeps DormitoriesModule exports limited to the public facade before selection catalog port extraction', () => {
    expect(moduleMetadata(DormitoriesModule, 'exports')).toEqual([DormitoriesService]);
  });
});
