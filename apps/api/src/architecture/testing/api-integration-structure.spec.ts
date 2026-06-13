import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const apiRoot = process.cwd();
const integrationRoot = join(apiRoot, 'test', 'integration');
const integrationReadmePath = join(integrationRoot, 'README.md');

const expectedRootIntegrationSpecs = [
  'account-deletion.integration.spec.ts',
  'auth-users-transaction.integration.spec.ts',
  'auth-verification.store.integration.spec.ts',
  'auth.service.integration.spec.ts',
  'chat.integration.spec.ts',
  'integration-fixtures.integration.spec.ts',
  'match-history.integration.spec.ts',
  'matches.integration.spec.ts',
  'migration-status.integration.spec.ts',
  'notifications.integration.spec.ts',
  'profile-match-score.integration.spec.ts',
  'retention-db-access-control.integration.spec.ts',
  'retention.integration.spec.ts',
  'roommate-search.integration.spec.ts',
  'season-registration.integration.spec.ts',
  'season-transition.integration.spec.ts',
  'social-safety-block.integration.spec.ts',
  'social-safety-bookmark.integration.spec.ts',
  'social-safety-report.integration.spec.ts',
  'support.integration.spec.ts',
  'time-boundary.integration.spec.ts',
  'timestamps.integration.spec.ts',
  'unmatch.integration.spec.ts',
  'users.integration.spec.ts',
] as const;

const expectedCurrentHelperFiles = [
  'active-match-lifecycle-event-assertions.ts',
  'integration-app.ts',
  'integration-db.ts',
  'integration-fixtures.ts',
  'integration-query-trace.ts',
] as const;

const expectedFinalIntegrationDirectories = [
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

const integrationMoveMap = [
  ['account-deletion.integration.spec.ts', 'users/account-deletion.integration.spec.ts'],
  ['auth-users-transaction.integration.spec.ts', 'auth/auth-users-transaction.integration.spec.ts'],
  [
    'auth-verification.store.integration.spec.ts',
    'auth/auth-verification.store.integration.spec.ts',
  ],
  ['auth.service.integration.spec.ts', 'auth/auth.service.integration.spec.ts'],
  ['chat.integration.spec.ts', 'chat/chat.integration.spec.ts'],
  ['integration-fixtures.integration.spec.ts', 'platform/integration-fixtures.integration.spec.ts'],
  ['match-history.integration.spec.ts', 'matches/match-history.integration.spec.ts'],
  ['matches.integration.spec.ts', 'matches/matches.integration.spec.ts'],
  ['migration-status.integration.spec.ts', 'platform/migration-status.integration.spec.ts'],
  ['notifications.integration.spec.ts', 'notifications/notifications.integration.spec.ts'],
  ['profile-match-score.integration.spec.ts', 'profiles/profile-match-score.integration.spec.ts'],
  [
    'retention-db-access-control.integration.spec.ts',
    'retention/retention-db-access-control.integration.spec.ts',
  ],
  ['retention.integration.spec.ts', 'retention/retention.integration.spec.ts'],
  ['roommate-search.integration.spec.ts', 'roommate-search/roommate-search.integration.spec.ts'],
  [
    'season-registration.integration.spec.ts',
    'season-participants/season-registration.integration.spec.ts',
  ],
  ['season-transition.integration.spec.ts', 'seasons/season-transition.integration.spec.ts'],
  [
    'social-safety-block.integration.spec.ts',
    'social-safety/social-safety-block.integration.spec.ts',
  ],
  [
    'social-safety-bookmark.integration.spec.ts',
    'social-safety/social-safety-bookmark.integration.spec.ts',
  ],
  [
    'social-safety-report.integration.spec.ts',
    'social-safety/social-safety-report.integration.spec.ts',
  ],
  ['support.integration.spec.ts', 'support/support.integration.spec.ts'],
  ['time-boundary.integration.spec.ts', 'platform/time-boundary.integration.spec.ts'],
  ['timestamps.integration.spec.ts', 'platform/timestamps.integration.spec.ts'],
  ['unmatch.integration.spec.ts', 'matches/unmatch.integration.spec.ts'],
  ['users.integration.spec.ts', 'users/users.integration.spec.ts'],
] as const;

const coverageTaxonomyLabels = [
  'policy-matrix',
  'transaction-atomicity',
  'concurrency-race',
  'idempotency',
  'side-effect-rollback',
  'stale-state-recheck',
  'db-time-boundary',
  'worker-claim',
  'security-boundary',
  'query-cost-guard',
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

describe('API integration test structure boundary', () => {
  it('keeps Vitest integration discovery recursive and serial-safe', () => {
    const integrationConfig = readSource(join(apiRoot, 'vitest.config.integration.ts'));

    expect(integrationConfig).toContain("include: ['test/integration/**/*.integration.spec.ts']");
    expect(integrationConfig).toContain("pool: 'forks'");
    expect(integrationConfig).toContain('fileParallelism: false');
    expect(integrationConfig).toContain("setupFiles: ['./test/setup/vitest.integration.setup.ts']");
    expect(integrationConfig).toContain('testTimeout: 60_000');
  });

  it('locks the current flat transition baseline before the domain directory split', () => {
    const rootIntegrationSpecs = directoryFileNames(integrationRoot).filter((fileName) =>
      fileName.endsWith('.integration.spec.ts'),
    );

    expect(rootIntegrationSpecs).toEqual(sorted(expectedRootIntegrationSpecs));
    expect(directoryNames(integrationRoot)).toEqual(['support']);
    expect(existsSync(join(integrationRoot, '_support'))).toBe(false);
  });

  it('keeps the current helper directory limited to integration-only helpers', () => {
    expect(directoryFileNames(join(integrationRoot, 'support'))).toEqual(
      sorted(expectedCurrentHelperFiles),
    );
  });

  it('locks the domain move map for the integration directory split', () => {
    const fromFiles = integrationMoveMap.map(([from]) => from);
    const targetFiles = integrationMoveMap.map(([, target]) => target);
    const targetDirectories = targetFiles.map((target) => target.substring(0, target.indexOf('/')));

    expect(sorted(fromFiles)).toEqual(sorted(expectedRootIntegrationSpecs));
    expect(new Set(targetFiles).size).toBe(targetFiles.length);
    expect(sorted([...new Set(targetDirectories), '_support'])).toEqual(
      sorted(expectedFinalIntegrationDirectories),
    );

    const readme = readSource(integrationReadmePath);

    for (const [from, target] of integrationMoveMap) {
      expect(readme).toContain(`\`${from}\``);
      expect(readme).toContain(`\`${target}\``);
    }
  });

  it('documents helper ownership, commands, and coverage taxonomy', () => {
    expect(existsSync(integrationReadmePath)).toBe(true);

    const readme = readSource(integrationReadmePath);

    expect(readme).toContain('API integration tests');
    expect(readme).toContain('test/integration/**/*.integration.spec.ts');
    expect(readme).toContain('`_support/` is test helper only');
    expect(readme).toContain('`support/` is the product support domain');
    expect(readme).toContain(
      'pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts --maxWorkers=1 test/integration/<domain>/<file>.integration.spec.ts',
    );
    expect(readme).toContain('pnpm --dir apps/api test:integration');
    expect(readme).toContain(
      'pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% src/architecture/testing/api-integration-structure.spec.ts',
    );

    for (const helperFile of expectedCurrentHelperFiles) {
      expect(readme).toContain(helperFile);
    }

    for (const directory of expectedFinalIntegrationDirectories) {
      expect(readme).toContain(`${directory}/`);
    }

    for (const label of coverageTaxonomyLabels) {
      expect(readme).toContain(`\`${label}\``);
    }
  });
});
