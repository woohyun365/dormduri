import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const integrationRoot = join(apiRoot, 'test', 'integration');
const expectedIntegrationDirectories = [
  '_support',
  'auth',
  'chat',
  'matches',
  'notifications',
  'platform',
  'profiles',
  'retention',
  'roommate-search',
  'season-participants',
  'seasons',
  'social-safety',
  'support',
  'users',
] as const;

const expectedHelperFiles = [
  'active-match-lifecycle-event-assertions.ts',
  'integration-app.ts',
  'integration-db.ts',
  'integration-fixtures.ts',
  'integration-query-budget.ts',
  'integration-query-trace.ts',
  'integration-suite.ts',
] as const;

const expectedIntegrationSpecPaths = [
  'auth/auth-users-transaction.integration.spec.ts',
  'auth/auth-verification.store.integration.spec.ts',
  'auth/auth.service.integration.spec.ts',
  'chat/chat.integration.spec.ts',
  'matches/match-history.integration.spec.ts',
  'matches/matches.integration.spec.ts',
  'matches/unmatch.integration.spec.ts',
  'notifications/notifications.integration.spec.ts',
  'platform/integration-fixtures.integration.spec.ts',
  'platform/migration-status.integration.spec.ts',
  'platform/time-boundary.integration.spec.ts',
  'platform/timestamps.integration.spec.ts',
  'profiles/profile-match-score.integration.spec.ts',
  'retention/retention-db-access-control.integration.spec.ts',
  'retention/retention.integration.spec.ts',
  'roommate-search/roommate-search.integration.spec.ts',
  'season-participants/season-registration.integration.spec.ts',
  'seasons/season-transition.integration.spec.ts',
  'social-safety/social-safety-block.integration.spec.ts',
  'social-safety/social-safety-bookmark.integration.spec.ts',
  'social-safety/social-safety-report.integration.spec.ts',
  'support/support.integration.spec.ts',
  'users/account-deletion.integration.spec.ts',
  'users/users.integration.spec.ts',
] as const;

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function sorted(values: readonly string[]) {
  return [...values].sort();
}

function directoryFileNames(root: string) {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
}

function directoryNames(root: string) {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
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

function relativeIntegrationPath(path: string) {
  return relative(integrationRoot, path).split(sep).join('/');
}

describe('API integration test structure boundary', () => {
  it('keeps Vitest integration discovery recursive and serial-safe', () => {
    const integrationConfig = readSource(join(apiRoot, 'vitest.config.integration.ts'));

    expect(integrationConfig).toContain("include: ['test/integration/**/*.integration.spec.ts']");
    expect(integrationConfig).toContain("pool: 'forks'");
    expect(integrationConfig).toContain('fileParallelism: false');
    expect(integrationConfig).toContain("setupFiles: ['./test/setup/vitest.integration.setup.ts']");
    expect(integrationConfig).toContain('testTimeout: 60_000');
  });

  it('keeps integration specs recursively under domain directories', () => {
    const actualDirectories = directoryNames(integrationRoot);
    const rootSpecFiles = directoryFileNames(integrationRoot).filter((file) =>
      file.endsWith('.integration.spec.ts'),
    );
    const actualSpecPaths = walkFiles(integrationRoot)
      .filter((path) => path.endsWith('.integration.spec.ts'))
      .map(relativeIntegrationPath)
      .sort();

    expect(actualDirectories).toEqual(sorted(expectedIntegrationDirectories));
    expect(rootSpecFiles).toEqual([]);
    expect(actualSpecPaths).toEqual(sorted(expectedIntegrationSpecPaths));
  });

  it('keeps helper files under _support and product support tests under support', () => {
    expect(directoryFileNames(join(integrationRoot, '_support'))).toEqual(
      sorted(expectedHelperFiles),
    );
    expect(directoryFileNames(join(integrationRoot, 'support'))).toEqual([
      'support.integration.spec.ts',
    ]);
  });

  it('keeps moved specs on _support helper imports instead of removed support helper paths', () => {
    const violations = walkFiles(integrationRoot)
      .filter((path) => path.endsWith('.ts'))
      .flatMap((path) => {
        const source = readSource(path);
        const relativePath = relativeIntegrationPath(path);
        const messages: string[] = [];

        if (/['"]\.\/support\//.test(source)) {
          messages.push(`${relativePath}: uses ./support helper path`);
        }

        if (/['"]\.\.\/support\//.test(source)) {
          messages.push(`${relativePath}: uses ../support helper path`);
        }

        if (/integration\/support\//.test(source)) {
          messages.push(`${relativePath}: references removed integration/support helper path`);
        }

        return messages;
      })
      .sort();

    expect(violations).toEqual([]);
  });
});
