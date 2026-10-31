import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');

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

function relativeApiPath(path: string) {
  return relative(apiRoot, path).split(sep).join('/');
}

function productionTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root)
    .filter((path) => !path.endsWith('.spec.ts'))
    .filter((path) => !path.endsWith('.cli.ts'))
    .filter((path) => !path.includes(`${sep}generated${sep}`));
}

describe('API logging boundary', () => {
  // request-route.ts builds log and metric route labels from controller and handler path metadata
  // only. A global prefix, versioning or RouterModule path would change the registered route
  // without changing those labels, so adding one must update resolveRouteTemplate first.
  it('keeps registered routes equal to controller and handler path metadata', () => {
    const offenders = productionTypeScriptFiles(apiSourceRoot)
      .filter((path) =>
        /\.(setGlobalPrefix|enableVersioning)\s*\(|\bRouterModule\.register\b/.test(
          readFileSync(path, 'utf8'),
        ),
      )
      .map(relativeApiPath)
      .sort();

    expect(offenders).toEqual([]);
  });

  it('keeps runtime production code off direct console logging', () => {
    const offenders = productionTypeScriptFiles(apiSourceRoot)
      .filter((path) => /\bconsole\s*\./.test(readFileSync(path, 'utf8')))
      .map(relativeApiPath)
      .sort();

    expect(offenders).toEqual([]);
  });
});
