import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DormitoriesModule } from '../../../src/dormitories/dormitories.module.js';
import { DormitoriesService } from '../../../src/dormitories/application/dormitories.service.js';
import { DORMITORY_SELECTION_CATALOG_PORT } from '../../../src/dormitories/selection-catalog/dormitory-selection-catalog.port.js';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const dormitoriesRoot = join(apiSourceRoot, 'dormitories');
const seasonParticipantsRoot = join(apiSourceRoot, 'season-participants');

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

function filesContaining(root: string, pattern: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => pattern.test(readSource(path)))
    .map(relativeSourcePath)
    .sort();
}

describe('dormitories product architecture boundary', () => {
  it('keeps dormitories independent from season-participants imports', () => {
    const forbiddenSeasonParticipantImport = /from\s+['"][^'"]*season-participants(?:\/|['"])/;

    expect(filesContaining(dormitoriesRoot, forbiddenSeasonParticipantImport)).toEqual([]);
    expect(existsSync(seasonParticipantsRoot)).toBe(true);
  });

  it('keeps DormitoriesModule exports limited to the public facade and selection catalog port', () => {
    expect(moduleMetadata(DormitoriesModule, 'exports')).toEqual([
      DormitoriesService,
      DORMITORY_SELECTION_CATALOG_PORT,
    ]);
  });
});
