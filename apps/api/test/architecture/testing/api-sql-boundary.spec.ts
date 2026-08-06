import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const sourceRoot = join(apiRoot, 'src');
const sqlRoot = join(apiRoot, 'prisma', 'sql');
const generatedSqlRoot = join(apiRoot, 'src', 'generated', 'prisma', 'sql');
const generatedSqlIndexPath = join(apiRoot, 'src', 'generated', 'prisma', 'sql.ts');

import {
  allowedSqlAssetCategories,
  forbiddenRawSqlPattern,
  forbiddenSessionAdvisoryLockPattern,
  skipLockedPattern,
  sqlAssetInventory,
  sqlTimePattern,
  transactionAdvisoryLockPattern,
  unsafeTypedSqlPayloadPattern,
} from './api-sql-inventory.fixture.js';

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

function sqlAssetFunctionName(path: string) {
  return basename(path, '.sql');
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

function actualSqlAssetPaths() {
  return walkFiles(sqlRoot)
    .filter((path) => path.endsWith('.sql'))
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

function findProductionFilesMatching(pattern: RegExp) {
  return walkFiles(sourceRoot)
    .filter(isProductionSourceFile)
    .filter((path) => pattern.test(readSource(path)))
    .map(relativeApiPath)
    .sort();
}

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, ' ');
}

describe('API SQL boundary inventory', () => {
  it('keeps every prisma/sql asset registered with owner, category, and semantics', () => {
    const actualPaths = actualSqlAssetPaths();
    const registryPaths = sorted(sqlAssetInventory.map((entry) => entry.path));

    expect(duplicateValues(registryPaths)).toEqual([]);
    expect({
      missingInRegistry: missingPaths(actualPaths, registryPaths),
      staleRegistryEntries: stalePaths(actualPaths, registryPaths),
    }).toEqual({
      missingInRegistry: [],
      staleRegistryEntries: [],
    });
  });

  it('keeps registered SQL assets generated through Prisma TypedSQL', () => {
    const generatedIndex = readSource(generatedSqlIndexPath);

    for (const entry of sqlAssetInventory) {
      const functionName = sqlAssetFunctionName(entry.path);

      expect(existsSync(join(apiRoot, entry.path)), `${entry.path} exists`).toBe(true);
      expect(
        existsSync(join(generatedSqlRoot, `${functionName}.ts`)),
        `${entry.path} generated module`,
      ).toBe(true);
      expect(generatedIndex, `${entry.path} generated index export`).toContain(
        `./sql/${functionName}.js`,
      );
    }
  });

  it('keeps each registered SQL category and semantic token explicit', () => {
    const allowedCategorySet = new Set<string>(allowedSqlAssetCategories);

    for (const entry of sqlAssetInventory) {
      const sql = normalizeSql(readSource(join(apiRoot, entry.path)));

      expect(entry.owner, `${entry.path} owner`).not.toHaveLength(0);
      expect(entry.rationale, `${entry.path} rationale`).not.toHaveLength(0);
      expect(allowedCategorySet.has(entry.category), `${entry.path} category`).toBe(true);
      expect(entry.requiredPatterns, `${entry.path} requiredPatterns`).not.toHaveLength(0);

      for (const pattern of entry.requiredPatterns) {
        expect(pattern.test(sql), `${entry.path} should match ${String(pattern)}`).toBe(true);
      }
    }
  });

  it('forbids session-scoped advisory locks in SQL assets', () => {
    const violations = sqlAssetInventory
      .map((entry) => ({ entry, sql: readSource(join(apiRoot, entry.path)) }))
      .filter(({ sql }) => forbiddenSessionAdvisoryLockPattern.test(sql))
      .map(({ entry }) => entry.path);

    expect(violations).toEqual([]);
  });

  it('keeps transaction advisory locks registered only as transaction-lock assets', () => {
    const actualLockPaths = actualSqlAssetPaths().filter((path) =>
      transactionAdvisoryLockPattern.test(readSource(join(apiRoot, path))),
    );
    const registryLockPaths = sorted(
      sqlAssetInventory
        .filter((entry) => entry.category === 'transaction-lock')
        .map((entry) => entry.path),
    );

    expect(actualLockPaths).toEqual(registryLockPaths);
  });

  it('keeps SKIP LOCKED SQL registered only as worker-claim assets', () => {
    const actualClaimPaths = actualSqlAssetPaths().filter((path) =>
      skipLockedPattern.test(readSource(join(apiRoot, path))),
    );
    const registryClaimPaths = sorted(
      sqlAssetInventory
        .filter((entry) => entry.category === 'worker-claim')
        .map((entry) => entry.path),
    );

    expect(actualClaimPaths).toEqual(registryClaimPaths);
  });

  it('keeps DB time SQL registered as db-time assets', () => {
    const actualDbTimePaths = actualSqlAssetPaths().filter((path) =>
      sqlTimePattern.test(readSource(join(apiRoot, path))),
    );
    const registryDbTimePaths = sorted(
      sqlAssetInventory.filter((entry) => entry.category === 'db-time').map((entry) => entry.path),
    );

    expect(actualDbTimePaths).toEqual(registryDbTimePaths);
  });

  it('prevents production code from bypassing generated TypedSQL with direct raw SQL strings', () => {
    expect({
      directRawSql: findProductionFilesMatching(forbiddenRawSqlPattern),
      unsafeTypedSqlPayload: findProductionFilesMatching(unsafeTypedSqlPayloadPattern),
    }).toEqual({
      directRawSql: [],
      unsafeTypedSqlPayload: [],
    });
  });

  it('keeps generated SQL imports on the index surface', () => {
    const deepSqlImportPattern = /generated\/prisma\/sql\//;
    expect(findProductionFilesMatching(deepSqlImportPattern)).toEqual([]);
  });
});
