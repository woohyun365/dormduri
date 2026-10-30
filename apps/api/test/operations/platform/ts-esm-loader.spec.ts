import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const loaderImport = '--import ./test/support/ts-esm-loader.mjs';

function runWithLoader(source: string) {
  return spawnSync(
    process.execPath,
    ['--import', './test/support/ts-esm-loader.mjs', '--input-type=module', '--eval', source],
    { cwd: apiRoot, encoding: 'utf8' },
  );
}

describe('API TypeScript ESM loader', () => {
  it('resolves .js specifiers to TypeScript sources and NestJS package export patterns', () => {
    // The registry imports @nestjs/config, whose dist imports `@nestjs/common/utils/*.js` through a `"./*.js"` export.
    const result = runWithLoader(
      [
        "const registry = await import('./src/config/composition/api-config.registry.js');",
        'console.log(registry.API_CONFIG_FACTORIES.length);',
      ].join('\n'),
    );

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('10');
  });

  it('emits the constructor metadata Nest dependency injection reads', () => {
    const result = runWithLoader(
      [
        "await import('reflect-metadata');",
        "const { DatabaseHealthCheck } = await import('./src/health/checks/database-health.check.js');",
        "const { PrismaService } = await import('./src/platform/database/prisma.service.js');",
        "const types = Reflect.getMetadata('design:paramtypes', DatabaseHealthCheck);",
        'console.log(types?.[0] === PrismaService);',
      ].join('\n'),
    );

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('true');
  });

  it('is the only TypeScript runner the API scripts use', () => {
    const manifest = JSON.parse(readFileSync(join(apiRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const typeScriptScripts = Object.values(manifest.scripts).filter((command) =>
      /^node .*\.ts(\s|$)/u.test(command),
    );

    expect(typeScriptScripts.length).toBeGreaterThan(0);
    expect(typeScriptScripts.filter((command) => !command.includes(loaderImport))).toEqual([]);
    expect(JSON.stringify(manifest)).not.toContain('ts-node');
  });
});
