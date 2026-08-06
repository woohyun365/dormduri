import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const sourceRoot = join(apiRoot, 'src');
const sqlRoot = join(apiRoot, 'prisma', 'sql');

import {
  allowedTimeSourceCategories,
  productionDatePattern,
  productionDateUsageInventory,
  sqlTimePattern,
  sqlTimeUsageInventory,
} from './api-time-source-inventory.fixture.js';

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function sorted(values: readonly string[]) {
  return [...values].sort();
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

function isProductionSourceFile(path: string) {
  const relativePath = relativeApiPath(path);

  return (
    path.endsWith('.ts') &&
    !path.endsWith('.spec.ts') &&
    !relativePath.includes('/test-support/') &&
    !relativePath.includes('/generated/')
  );
}

function findProductionDateUsageFiles() {
  return walkFiles(sourceRoot)
    .filter(isProductionSourceFile)
    .filter((path) => productionDatePattern.test(readSource(path)))
    .map(relativeApiPath)
    .sort();
}

function findSqlTimeUsageFiles() {
  return walkFiles(sqlRoot)
    .filter((path) => path.endsWith('.sql'))
    .filter((path) => sqlTimePattern.test(readSource(path)))
    .map(relativeApiPath)
    .sort();
}

function duplicateValues(values: readonly string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
      continue;
    }
    seen.add(value);
  }

  return sorted([...duplicates]);
}

function missingPaths(actual: readonly string[], expected: readonly string[]) {
  const expectedSet = new Set(expected);
  return actual.filter((path) => !expectedSet.has(path));
}

function stalePaths(actual: readonly string[], expected: readonly string[]) {
  const actualSet = new Set(actual);
  return expected.filter((path) => !actualSet.has(path));
}

describe('API time source boundary inventory', () => {
  it('keeps production Date usage registered with owner and rationale', () => {
    const actualPaths = findProductionDateUsageFiles();
    const registryPaths = sorted(productionDateUsageInventory.map((entry) => entry.path));

    expect(duplicateValues(registryPaths)).toEqual([]);
    expect({
      missingInRegistry: missingPaths(actualPaths, registryPaths),
      staleRegistryEntries: stalePaths(actualPaths, registryPaths),
    }).toEqual({
      missingInRegistry: [],
      staleRegistryEntries: [],
    });
  });

  it('keeps SQL time functions registered with owner and rationale', () => {
    const actualPaths = findSqlTimeUsageFiles();
    const registryPaths = sorted(sqlTimeUsageInventory.map((entry) => entry.path));

    expect(duplicateValues(registryPaths)).toEqual([]);
    expect({
      missingInRegistry: missingPaths(actualPaths, registryPaths),
      staleRegistryEntries: stalePaths(actualPaths, registryPaths),
    }).toEqual({
      missingInRegistry: [],
      staleRegistryEntries: [],
    });
  });

  it('keeps each Date usage category explicit and documented', () => {
    const allowedCategorySet = new Set<string>(allowedTimeSourceCategories);

    for (const entry of productionDateUsageInventory) {
      expect(existsSync(join(apiRoot, entry.path)), `${entry.path} exists`).toBe(true);
      expect(entry.owner, `${entry.path} owner`).not.toHaveLength(0);
      expect(entry.rationale, `${entry.path} rationale`).not.toHaveLength(0);
      expect(allowedCategorySet.has(entry.category), `${entry.path} category`).toBe(true);
    }
  });

  it('keeps each SQL time usage rationale explicit', () => {
    for (const entry of sqlTimeUsageInventory) {
      expect(existsSync(join(apiRoot, entry.path)), `${entry.path} exists`).toBe(true);
      expect(entry.owner, `${entry.path} owner`).not.toHaveLength(0);
      expect(entry.rationale, `${entry.path} rationale`).not.toHaveLength(0);
    }
  });
});
