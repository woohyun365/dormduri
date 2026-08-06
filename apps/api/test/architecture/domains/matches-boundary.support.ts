import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const apiRoot = process.cwd();
export const apiSourceRoot = join(apiRoot, 'src');
export const matchesRoot = join(apiSourceRoot, 'matches');

export function walkTypeScriptFiles(root: string): string[] {
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return walkTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

export function productionTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root).filter((path) => !path.endsWith('.spec.ts'));
}

export function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

export function apiRelative(path: string) {
  return relative(apiRoot, path).split(sep).join('/');
}

export function filesContaining(root: string, forbidden: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => forbidden.test(readSource(path)))
    .map(apiRelative)
    .sort();
}

export function externalProductionFiles() {
  const matchesPrefix = `${matchesRoot}${sep}`;
  const generatedPrefix = `${join(apiSourceRoot, 'generated')}${sep}`;
  return productionTypeScriptFiles(apiSourceRoot).filter(
    (path) => !path.startsWith(matchesPrefix) && !path.startsWith(generatedPrefix),
  );
}
