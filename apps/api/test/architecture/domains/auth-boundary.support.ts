import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const apiRoot = process.cwd();
export const apiSourceRoot = join(apiRoot, 'src');
export const authRoot = join(apiSourceRoot, 'auth');

export function walkTypeScriptFiles(root: string): string[] {
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return walkTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

export function walkDirectories(root: string): string[] {
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const path = join(root, entry.name);
    return [path, ...walkDirectories(path)];
  });
}

export function productionTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root).filter((path) => !path.endsWith('.spec.ts'));
}

export function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

export function relativeSourcePath(path: string) {
  return relative(apiRoot, path);
}

export function offendingFiles(root: string, forbidden: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => forbidden.test(readSource(path)))
    .map(relativeSourcePath)
    .sort();
}

export function importSpecifiers(source: string): string[] {
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].flatMap((match) =>
    match[1] ? [match[1]] : [],
  );
}

export function externalAuthSourceRoots() {
  return readdirSync(apiSourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'auth' && entry.name !== 'generated')
    .map((entry) => join(apiSourceRoot, entry.name));
}
