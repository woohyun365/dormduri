import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { AppModule } from '../../../src/app.module.js';

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

describe('API module product boundary', () => {
  it('keeps app root imports explicit without a common fallback module', () => {
    const appSource = readSource(join(apiSourceRoot, 'app.module.ts'));

    expect(AppModule).toBeDefined();
    expect(appSource).toContain(
      "import { PrismaModule } from './platform/database/prisma.module.js'",
    );
    expect(appSource).toContain(
      "import { LifecycleModule } from './lifecycle/lifecycle.module.js'",
    );
    expect(appSource).not.toMatch(/CommonModule|from ['"].*common\//);
  });

  it('keeps module wiring free of common imports, forwardRef, and hidden business globals', () => {
    expect(filesContaining(apiSourceRoot, /from\s+['"].*common\//)).toEqual([]);
    expect(filesContaining(apiSourceRoot, /\bforwardRef\s*\(/)).toEqual([]);
    expect(filesContaining(apiSourceRoot, /@Global\s*\(\s*\)/)).toEqual([
      'src/platform/database/prisma.module.ts',
    ]);
  });
});
