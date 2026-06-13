import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const lifecycleRoot = join(apiSourceRoot, 'lifecycle');
const seasonParticipantsRoot = join(apiSourceRoot, 'season-participants');

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

describe('users product architecture boundary', () => {
  it('keeps season-participants away from users route error internals', () => {
    const forbiddenUsersErrorImport =
      /from\s+['"][^'"]*users\/(?:users\.errors|errors\/[^'"]+)(?:\.js)?['"]/;

    expect(filesContaining(seasonParticipantsRoot, forbiddenUsersErrorImport)).toEqual([]);
  });

  it('keeps lifecycle retention sweep outside the users public port surface', () => {
    const adapterPath = join(lifecycleRoot, 'adapters', 'lifecycle-sweep-tasks.adapter.ts');
    const source = readSource(adapterPath);
    const removedUsersRetentionSweepPortName = ['USER', 'RETENTION', 'SWEEP', 'PORT'].join('_');

    expect(source).toContain('RETENTION_SWEEP_PORT');
    expect(source).not.toContain(removedUsersRetentionSweepPortName);
    expect(source).not.toMatch(/UsersService|users\.service/);
  });
});
