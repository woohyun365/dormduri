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

  if (
    /^src\/.*\.spec\.ts$/.test(apiPath) ||
    /^test\/(?:architecture|operations)\/.*\.spec\.ts$/.test(apiPath)
  ) {
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
        relativeApiPath(path) !== 'test/architecture/testing/api-test-runner-boundary.spec.ts',
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
    const apiPackage = readJson<{ scripts: Record<string, unknown> }>(
      join(apiRoot, 'package.json'),
    );

    for (const scriptName of [
      'test',
      'test:integration',
      'test:e2e',
      'test:cov',
      'test:debug',
      'test:watch',
      'ci:test:runtime-config-health-contract',
      'ci:test:unit',
      'ci:test:integration',
      'ci:test:e2e',
      'ci:test:stress',
    ]) {
      const command = scriptValue(apiPackage.scripts, scriptName);

      expect(command).not.toMatch(/(^|\s)jest(\s|$)|@swc\/jest|test\/jest-/);
    }

    expect(scriptValue(apiPackage.scripts, 'test')).toContain('ci:test:unit');
    expect(scriptValue(apiPackage.scripts, 'test:integration')).toContain('ci:test:integration');
    expect(scriptValue(apiPackage.scripts, 'test:e2e')).toContain('ci:test:e2e');

    const unitCommand = scriptValue(apiPackage.scripts, 'ci:test:unit');
    expect(unitCommand).toContain('vitest run');
    expect(unitCommand).toContain('--config ./vitest.config.unit.ts');
    expect(unitCommand).toContain('--maxWorkers=50%');

    const runtimeBoundaryCommand = scriptValue(
      apiPackage.scripts,
      'ci:test:runtime-config-health-contract',
    );
    expect(runtimeBoundaryCommand).toContain('vitest run');
    expect(runtimeBoundaryCommand).toContain(
      '--config ./vitest.config.runtime-config-health-contract.ts',
    );
    expect(runtimeBoundaryCommand).toContain('--maxWorkers=50%');

    const integrationCommand = scriptValue(apiPackage.scripts, 'ci:test:integration');
    expect(integrationCommand).toContain('vitest run');
    expect(integrationCommand).toContain('--config ./vitest.config.integration.ts');
    expect(integrationCommand).toContain('--maxWorkers=1');

    const e2eCommand = scriptValue(apiPackage.scripts, 'ci:test:e2e');
    expect(e2eCommand).toContain('vitest run');
    expect(e2eCommand).toContain('--config ./vitest.config.e2e.ts');
    expect(e2eCommand).toContain('--maxWorkers=1');
    expect(scriptValue(apiPackage.scripts, 'ci:test:coverage')).toContain('--coverage');
  });

  it('keeps the API test runner free of direct Jest dependencies', () => {
    const rootPackage = readJson<Record<string, unknown>>(join(repoRoot, 'package.json'));
    const apiPackage = readJson<Record<string, unknown>>(join(apiRoot, 'package.json'));
    const forbiddenDependencies = ['jest', '@swc/jest', '@types/jest'] as const;

    expectNoDirectDependency(rootPackage, forbiddenDependencies);
    expectNoDirectDependency(apiPackage, forbiddenDependencies);
    expect(Object.hasOwn(apiPackage, 'jest')).toBe(false);

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
    const runtimeBoundaryConfigPath = join(
      apiRoot,
      'vitest.config.runtime-config-health-contract.ts',
    );

    for (const configPath of [
      baseConfigPath,
      unitConfigPath,
      integrationConfigPath,
      e2eConfigPath,
      stressConfigPath,
      runtimeBoundaryConfigPath,
    ]) {
      expect(existsSync(configPath)).toBe(true);
    }

    const baseConfig = readSource(baseConfigPath);
    const unitConfig = readSource(unitConfigPath);
    const integrationConfig = readSource(integrationConfigPath);
    const e2eConfig = readSource(e2eConfigPath);
    const stressConfig = readSource(stressConfigPath);
    const runtimeBoundaryConfig = readSource(runtimeBoundaryConfigPath);

    expect(baseConfig).toContain("from 'vitest/config'");
    expect(baseConfig).toContain('globals: false');
    expect(baseConfig).toContain("provider: 'v8'");
    expect(unitConfig).toContain("pool: 'forks'");
    for (const unitSource of [
      'src/**/*.spec.ts',
      'test/architecture/**/*.spec.ts',
      'test/operations/**/*.spec.ts',
    ]) {
      expect(unitConfig).toContain(unitSource);
    }
    expect(integrationConfig).toContain("pool: 'forks'");
    expect(integrationConfig).toContain('fileParallelism: false');
    expect(integrationConfig).toContain("include: ['test/integration/**/*.integration.spec.ts']");
    expect(e2eConfig).toContain("pool: 'forks'");
    expect(e2eConfig).toContain('fileParallelism: false');
    expect(e2eConfig).toContain("include: ['test/e2e/**/*.e2e-spec.ts']");
    expect(e2eConfig).not.toContain('passWithNoTests');
    expect(stressConfig).toContain("include: ['test/stress/**/*.spec.ts']");
    expect(runtimeBoundaryConfig).toContain("'src/config/**/*.spec.ts'");
    expect(runtimeBoundaryConfig).toContain("'src/platform/runtime/**/*.spec.ts'");
    expect(runtimeBoundaryConfig).toContain("'src/health/**/*.spec.ts'");
    expect(runtimeBoundaryConfig).toContain(
      "'test/operations/platform/deployment-env-contract.spec.ts'",
    );
    expect(runtimeBoundaryConfig).toContain("'test/operations/platform/deployment-infra.spec.ts'");
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
