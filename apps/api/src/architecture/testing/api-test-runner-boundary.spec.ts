import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const repoRoot = join(apiRoot, '..', '..');
const apiSourceRoot = join(apiRoot, 'src');
const apiTestRoot = join(apiRoot, 'test');

function stripJsonComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function readJson<T>(path: string): T {
  return JSON.parse(stripJsonComments(readFileSync(path, 'utf8'))) as T;
}

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function walkFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      return walkFiles(path);
    }

    return entry.isFile() ? [path] : [];
  });
}

function relativeApiPath(path: string) {
  return relative(apiRoot, path).split(sep).join('/');
}

function runnerLanes(path: string): string[] {
  const apiPath = relativeApiPath(path);
  const lanes: string[] = [];

  if (/^src\/.*\.spec\.ts$/.test(apiPath) || /^test\/operations\/.*\.spec\.ts$/.test(apiPath)) {
    lanes.push('unit');
  }
  if (/^test\/integration\/.*\.integration\.spec\.ts$/.test(apiPath)) {
    lanes.push('integration');
  }
  if (/^test\/e2e\/.*\.e2e-spec\.ts$/.test(apiPath)) {
    lanes.push('e2e');
  }
  if (/^test\/stress\/.*\.spec\.ts$/.test(apiPath)) {
    lanes.push('stress');
  }

  return lanes;
}

function scriptValue(scripts: Record<string, unknown>, key: string) {
  const value = scripts[key];
  expect(typeof value).toBe('string');
  return value as string;
}

function objectKeys(value: unknown) {
  return value && typeof value === 'object' ? Object.keys(value) : [];
}

function dependencyNames(packageJson: { dependencies?: unknown; devDependencies?: unknown }) {
  return [
    ...objectKeys(packageJson.dependencies),
    ...objectKeys(packageJson.devDependencies),
  ].sort();
}

function expectNoDirectDependency(
  packageJson: { dependencies?: unknown; devDependencies?: unknown },
  forbidden: readonly string[],
) {
  const dependencies = dependencyNames(packageJson);
  expect(dependencies.filter((name) => forbidden.includes(name))).toEqual([]);
}

function typeScriptFiles(root: string) {
  return walkFiles(root)
    .filter((path) => path.endsWith('.ts'))
    .filter((path) => !path.includes(`${sep}generated${sep}`))
    .filter(
      (path) =>
        relativeApiPath(path) !== 'src/architecture/testing/api-test-runner-boundary.spec.ts',
    )
    .sort();
}

const forbiddenRunnerApiPatterns = [
  { name: 'jest object API', pattern: /\bjest\s*\./ },
  {
    name: 'Jest namespace/type',
    pattern: /\bJest\b|\bjest\.(?:Mock|Mocked|MockedFunction|SpyInstance)\b/,
  },
  {
    name: '@jest/globals import',
    pattern: /from\s+['"]@jest\/globals['"]|import\s+['"]@jest\/globals['"]/,
  },
] as const;

describe('API test runner boundary', () => {
  it('keeps official API package scripts on Vitest instead of Jest', () => {
    const rootPackage = readJson<{ scripts: Record<string, unknown> }>(
      join(repoRoot, 'package.json'),
    );
    const apiPackage = readJson<{ scripts: Record<string, unknown> }>(
      join(apiRoot, 'package.json'),
    );

    expect(scriptValue(rootPackage.scripts, 'api:test')).toBe('pnpm --dir apps/api test');
    expect(scriptValue(rootPackage.scripts, 'test:api')).toBe('pnpm api:test');
    expect(scriptValue(rootPackage.scripts, 'api:test:integration')).toBe(
      'pnpm --dir apps/api test:integration',
    );

    for (const scriptName of [
      'test',
      'test:integration',
      'test:e2e',
      'test:cov',
      'test:debug',
      'test:watch',
      'test:vitest:unit',
      'test:vitest:integration',
      'test:vitest:e2e',
    ]) {
      const command = scriptValue(apiPackage.scripts, scriptName);

      expect(command).not.toMatch(/(^|\s)jest(\s|$)|@swc\/jest|test\/jest-/);
    }

    expect(scriptValue(apiPackage.scripts, 'test')).toContain('vitest run');
    expect(scriptValue(apiPackage.scripts, 'test')).toContain('--config ./vitest.config.unit.ts');
    expect(scriptValue(apiPackage.scripts, 'test')).toContain('--maxWorkers=50%');
    expect(scriptValue(apiPackage.scripts, 'test:integration')).toContain('vitest run');
    expect(scriptValue(apiPackage.scripts, 'test:integration')).toContain(
      '--config ./vitest.config.integration.ts',
    );
    expect(scriptValue(apiPackage.scripts, 'test:integration')).toContain('--maxWorkers=1');
    expect(scriptValue(apiPackage.scripts, 'test:e2e')).toContain('vitest run');
    expect(scriptValue(apiPackage.scripts, 'test:e2e')).toContain(
      '--config ./vitest.config.e2e.ts',
    );
    expect(scriptValue(apiPackage.scripts, 'test:e2e')).toContain('--maxWorkers=1');
    expect(scriptValue(apiPackage.scripts, 'test:cov')).toContain('--coverage');
  });

  it('keeps direct API/root Jest runner dependencies and config files removed', () => {
    const rootPackage = readJson<Record<string, unknown>>(join(repoRoot, 'package.json'));
    const apiPackage = readJson<Record<string, unknown>>(join(apiRoot, 'package.json'));
    const forbiddenDependencies = ['jest', '@swc/jest', '@types/jest'] as const;

    expectNoDirectDependency(rootPackage, forbiddenDependencies);
    expectNoDirectDependency(apiPackage, forbiddenDependencies);
    expect(Object.hasOwn(apiPackage, 'jest')).toBe(false);

    for (const removedPath of [
      'test/jest-integration.json',
      'test/jest-e2e.json',
      'test/integration/support/suppress-known-pg-warning.cjs',
    ]) {
      expect(existsSync(join(apiRoot, removedPath))).toBe(false);
    }

    const lockfile = readSource(join(repoRoot, 'pnpm-lock.yaml'));
    expect(lockfile).not.toMatch(/\n\s{2}'?jest'?:\s|^\s{2}jest@/m);
    expect(lockfile).not.toContain("'@swc/jest'");
    expect(lockfile).not.toContain("'@types/jest'");
  });

  it('keeps source and test TypeScript configs free of Jest global types', () => {
    for (const tsconfigPath of ['tsconfig.json', 'test/tsconfig.json']) {
      const tsconfig = readJson<{ compilerOptions?: { types?: unknown } }>(
        join(apiRoot, tsconfigPath),
      );
      const types = tsconfig.compilerOptions?.types;

      expect(Array.isArray(types)).toBe(true);
      expect(types).not.toContain('jest');
      expect(types).toContain('node');
    }
  });

  it('keeps Vitest config as the API test runner source of truth', () => {
    const baseConfigPath = join(apiRoot, 'vitest.config.base.ts');
    const unitConfigPath = join(apiRoot, 'vitest.config.unit.ts');
    const integrationConfigPath = join(apiRoot, 'vitest.config.integration.ts');
    const e2eConfigPath = join(apiRoot, 'vitest.config.e2e.ts');
    const stressConfigPath = join(apiRoot, 'vitest.config.stress.ts');

    for (const configPath of [
      baseConfigPath,
      unitConfigPath,
      integrationConfigPath,
      e2eConfigPath,
      stressConfigPath,
    ]) {
      expect(existsSync(configPath)).toBe(true);
    }

    const baseConfig = readSource(baseConfigPath);
    const unitConfig = readSource(unitConfigPath);
    const integrationConfig = readSource(integrationConfigPath);
    const e2eConfig = readSource(e2eConfigPath);
    const stressConfig = readSource(stressConfigPath);

    expect(baseConfig).toContain("from 'vitest/config'");
    expect(baseConfig).toContain('globals: false');
    expect(baseConfig).toContain("provider: 'v8'");
    expect(unitConfig).toContain("pool: 'forks'");
    expect(unitConfig).toContain("include: ['src/**/*.spec.ts', 'test/operations/**/*.spec.ts']");
    expect(integrationConfig).toContain("pool: 'forks'");
    expect(integrationConfig).toContain('fileParallelism: false');
    expect(integrationConfig).toContain("include: ['test/integration/**/*.integration.spec.ts']");
    expect(e2eConfig).toContain("pool: 'forks'");
    expect(e2eConfig).toContain('fileParallelism: false');
    expect(e2eConfig).toContain("include: ['test/e2e/**/*.e2e-spec.ts']");
    expect(e2eConfig).not.toContain('passWithNoTests');
    expect(stressConfig).toContain("include: ['test/stress/**/*.spec.ts']");
  });

  it('collects every test spec in exactly one semantic runner lane', () => {
    const testSpecs = walkFiles(apiTestRoot)
      .filter((path) => path.endsWith('.spec.ts') || path.endsWith('.e2e-spec.ts'))
      .map((path) => ({ path: relativeApiPath(path), lanes: runnerLanes(path) }));

    expect(testSpecs.filter(({ lanes }) => lanes.length !== 1)).toEqual([]);
    expect(testSpecs.some(({ lanes }) => lanes[0] === 'integration')).toBe(true);
    expect(testSpecs.some(({ lanes }) => lanes[0] === 'e2e')).toBe(true);
    expect(testSpecs.some(({ lanes }) => lanes[0] === 'stress')).toBe(true);
    expect(testSpecs.some(({ lanes }) => lanes[0] === 'unit')).toBe(true);
  });

  it('keeps API ESLint generated artifacts ignored and typed assertion cleanup explicit', () => {
    const eslintConfig = readSource(join(apiRoot, 'eslint.config.mjs'));

    expect(eslintConfig).toContain('globalIgnores');
    expect(eslintConfig).toContain("'coverage/**'");
    expect(eslintConfig).toContain("'src/generated/**'");
    expect(eslintConfig).toContain("'dist/**'");
    expect(eslintConfig).toContain('tseslint.configs.recommendedTypeChecked');
    expect(eslintConfig).toContain("'@typescript-eslint/no-unnecessary-type-assertion': 'error'");
  });

  it('keeps API source and integration tests off Jest runner APIs', () => {
    const violations = [...typeScriptFiles(apiSourceRoot), ...typeScriptFiles(apiTestRoot)]
      .flatMap((path) => {
        const source = readSource(path);

        return forbiddenRunnerApiPatterns
          .filter(({ pattern }) => pattern.test(source))
          .map(({ name }) => `${relativeApiPath(path)}: ${name}`);
      })
      .sort();

    expect(violations).toEqual([]);
  });
});
