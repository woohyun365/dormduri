import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const sourceRoot = join(apiRoot, 'src');
const sqlRoot = join(apiRoot, 'prisma', 'sql');

const productionDatePattern = /\bnew\s+Date\s*\(|\bDate\.now\s*\(/;
const sqlTimePattern = /\bCURRENT_TIMESTAMP\b|\bNOW\s*\(/i;

const allowedTimeSourceCategories = [
  'business-db-now',
  'cache-ttl',
  'date-arithmetic',
  'dispatcher-default',
  'duration-metric',
  'parser',
  'response-timestamp',
] as const;

type TimeSourceCategory = (typeof allowedTimeSourceCategories)[number];

interface TimeSourceInventoryEntry {
  path: string;
  owner: string;
  category: TimeSourceCategory;
  rationale: string;
}

interface SqlTimeInventoryEntry {
  path: string;
  owner: string;
  rationale: string;
}

const productionDateUsageInventory: readonly TimeSourceInventoryEntry[] = [
  entry({
    path: 'src/auth/verification/request/auth-verification-timing.policy.ts',
    owner: 'auth/verification',
    category: 'duration-metric',
    rationale:
      'auth instrumentation measures elapsed duration; it is not a persisted business time.',
  }),
  entry({
    path: 'src/auth/operations/cleanup/auth-operational-cleanup.service.ts',
    owner: 'auth/operations',
    category: 'date-arithmetic',
    rationale:
      'cleanup cutoffs are derived from the explicit database-now input passed into the operation.',
  }),
  entry({
    path: 'src/auth/mail/auth-mail-outbox-writer.service.ts',
    owner: 'auth/mail',
    category: 'date-arithmetic',
    rationale:
      'password-change mail expiry is derived from the explicit transaction-scoped now supplied by the owning credential command.',
  }),
  entry({
    path: 'src/auth/mail/auth-mail-outbox.repository.ts',
    owner: 'auth/mail',
    category: 'date-arithmetic',
    rationale:
      'outbox stale-claim cutoff is derived from the explicit dispatcher-owned now supplied to the repository.',
  }),
  entry({
    path: 'src/auth/sessions/issue-session.command.ts',
    owner: 'auth/sessions',
    category: 'date-arithmetic',
    rationale:
      'session TTL values are calculated from PrismaService.getDatabaseNow() issued/database time.',
  }),
  entry({
    path: 'src/auth/sessions/renew-session.command.ts',
    owner: 'auth/sessions',
    category: 'date-arithmetic',
    rationale: 'renewal rotation TTL values are calculated from transaction-scoped databaseNow.',
  }),
  entry({
    path: 'src/auth/sessions/session-lifecycle.policy.ts',
    owner: 'auth/sessions',
    category: 'date-arithmetic',
    rationale:
      'session lifecycle policy accepts an injectable now and compares persisted session timestamps.',
  }),
  entry({
    path: 'src/auth/verification/auth-verification.service.ts',
    owner: 'auth/verification',
    category: 'duration-metric',
    rationale:
      'verification instrumentation measures elapsed duration; it is not persisted business time.',
  }),
  entry({
    path: 'src/auth/verification/request/auth-verification-request.repository.ts',
    owner: 'auth/verification',
    category: 'date-arithmetic',
    rationale:
      'verification code expiry is derived from the database-issued timestamp supplied to the transaction.',
  }),
  entry({
    path: 'src/auth/verification/challenge/auth-verification-challenge.repository.ts',
    owner: 'auth/verification/challenge',
    category: 'date-arithmetic',
    rationale:
      'verification grant expiry is derived from the database verification timestamp inside the challenge transaction.',
  }),
  entry({
    path: 'src/chat/application/chat.service.ts',
    owner: 'chat/application',
    category: 'parser',
    rationale: 'chat facade rehydrates lifecycle event timestamps from persisted event payloads.',
  }),
  entry({
    path: 'src/chat/outbox/chat-realtime-outbox.repository.ts',
    owner: 'chat/outbox',
    category: 'date-arithmetic',
    rationale: 'outbox lease and replay cutoffs are derived from an explicit caller-supplied now.',
  }),
  entry({
    path: 'src/chat/outbox/chat-realtime-outbox.service.ts',
    owner: 'chat/outbox',
    category: 'dispatcher-default',
    rationale:
      'outbox event creation accepts occurredAt and keeps a testable fallback for dispatcher-owned events.',
  }),
  entry({
    path: 'src/chat/outbox/chat-realtime-replay.service.ts',
    owner: 'chat/outbox',
    category: 'date-arithmetic',
    rationale: 'replay window cutoff is derived from an explicit caller-supplied now.',
  }),
  entry({
    path: 'src/chat/queries/chat-thread-list-cursor.ts',
    owner: 'chat/queries',
    category: 'parser',
    rationale:
      'query cursor decodes an ISO timestamp string; it does not create source-of-truth time.',
  }),
  entry({
    path: 'src/social-safety/enforcements/queries/enforcement-notice-list.cursor.ts',
    owner: 'social-safety/enforcements',
    category: 'parser',
    rationale:
      'enforcement notice cursor decodes an ISO updatedAt timestamp string for pagination only.',
  }),
  entry({
    path: 'src/social-safety/reports/queries/report-list.cursor.ts',
    owner: 'social-safety/reports',
    category: 'parser',
    rationale: 'report list cursor decodes an ISO receivedAt timestamp string for pagination only.',
  }),
  entry({
    path: 'src/chat/realtime/chat-realtime-allow-request-limiter.ts',
    owner: 'chat/realtime',
    category: 'cache-ttl',
    rationale:
      'in-memory realtime allow limiter uses a monotonic-ish process clock for local rate limiting only.',
  }),
  entry({
    path: 'src/chat/realtime/chat-realtime-dispatcher.service.ts',
    owner: 'chat/realtime',
    category: 'dispatcher-default',
    rationale:
      'dispatcher accepts injected now and uses a fallback only for worker claim/retry scheduling.',
  }),
  entry({
    path: 'src/chat/realtime/chat-realtime-rate-limiter.service.ts',
    owner: 'chat/realtime',
    category: 'cache-ttl',
    rationale: 'in-memory realtime rate limiter uses process time for local throttling only.',
  }),
  entry({
    path: 'src/chat/realtime/chat-realtime-ticket.service.ts',
    owner: 'chat/realtime',
    category: 'date-arithmetic',
    rationale:
      'realtime ticket TTL is derived from an injectable now and is covered by ticket contract tests.',
  }),
  entry({
    path: 'src/chat/realtime/chat-realtime.metrics.ts',
    owner: 'chat/realtime',
    category: 'response-timestamp',
    rationale:
      'metrics last-failure timestamp is an operational response/telemetry value, not domain state.',
  }),
  entry({
    path: 'src/chat/retention/conversation-retained-body.service.ts',
    owner: 'chat/retention',
    category: 'parser',
    rationale:
      'retained body service rehydrates archived event timestamps from persisted retention payloads.',
  }),
  entry({
    path: 'src/dormitories/selection-catalog/prisma-dormitory-selection-catalog.adapter.ts',
    owner: 'dormitories/selection-catalog',
    category: 'date-arithmetic',
    rationale: 'selection catalog derives UTC date bounds from explicit KST domain date input.',
  }),
  entry({
    path: 'src/health/checks/database-health.check.ts',
    owner: 'health/checks',
    category: 'duration-metric',
    rationale: 'readiness DB check uses process time only to report elapsed probe duration.',
  }),
  entry({
    path: 'src/health/checks/email-provider-health.check.ts',
    owner: 'health/checks',
    category: 'duration-metric',
    rationale:
      'readiness email provider check uses process time only to report elapsed probe duration.',
  }),
  entry({
    path: 'src/health/checks/health-check-result.ts',
    owner: 'health/checks',
    category: 'response-timestamp',
    rationale:
      'readiness check result timestamp and elapsedMs are response metadata only, not persisted business time.',
  }),
  entry({
    path: 'src/health/checks/migration-baseline-health.check.ts',
    owner: 'health/checks',
    category: 'duration-metric',
    rationale:
      'readiness migration baseline check uses process time only to report elapsed probe duration.',
  }),
  entry({
    path: 'src/health/checks/runtime-config-health.check.ts',
    owner: 'health/checks',
    category: 'duration-metric',
    rationale:
      'readiness runtime config check uses process time only to report elapsed probe duration.',
  }),
  entry({
    path: 'src/health/checks/secret-source-health.check.ts',
    owner: 'health/checks',
    category: 'duration-metric',
    rationale:
      'readiness secret source check uses process time only to report elapsed probe duration.',
  }),
  entry({
    path: 'src/health/presenters/health-response.presenter.ts',
    owner: 'health/presenters',
    category: 'response-timestamp',
    rationale:
      'health response timestamp is response metadata only and is not persisted business time.',
  }),
  entry({
    path: 'src/lifecycle/adapters/season-boundary-schedule.adapter.ts',
    owner: 'lifecycle/adapters',
    category: 'parser',
    rationale:
      'scheduler adapter converts configured KST local dates into Date values for cron boundaries.',
  }),
  entry({
    path: 'src/lifecycle/lifecycle-sweep-runner.ts',
    owner: 'lifecycle',
    category: 'duration-metric',
    rationale: 'lifecycle sweep runner measures elapsed duration for observability only.',
  }),
  entry({
    path: 'src/matches/active/presenters/active-match.presenter.ts',
    owner: 'matches/active',
    category: 'date-arithmetic',
    rationale: 'presenter converts room-selection local date into response timestamp metadata.',
  }),
  entry({
    path: 'src/matches/history/application/match-history-query.service.ts',
    owner: 'matches/history',
    category: 'date-arithmetic',
    rationale: 'history query derives a date-only cutoff from explicit query now input.',
  }),
  entry({
    path: 'src/matches/history/materialization/ended-season-history.loader.ts',
    owner: 'matches/history',
    category: 'date-arithmetic',
    rationale:
      'ended-season loader derives a date-only cutoff from explicit materialization now input.',
  }),
  entry({
    path: 'src/matches/history/materialization/match-history-materialization.policy.ts',
    owner: 'matches/history',
    category: 'date-arithmetic',
    rationale: 'history materialization policy converts season end date into a KST boundary Date.',
  }),
  entry({
    path: 'src/matches/overview/current-match-activity.presenter.ts',
    owner: 'matches/overview',
    category: 'parser',
    rationale:
      'current activity presenter parses contract ISO timestamps only for deterministic ordering.',
  }),
  entry({
    path: 'src/matches/requests/policies/match-request-expiration.policy.ts',
    owner: 'matches/requests',
    category: 'date-arithmetic',
    rationale:
      'match request expiration is calculated from explicit request/room-selection reference dates.',
  }),
  entry({
    path: 'src/moderation/moderation.service.ts',
    owner: 'moderation',
    category: 'cache-ttl',
    rationale:
      'moderation cache expiry is process-local memoization and is not persisted product time.',
  }),
  entry({
    path: 'src/platform/observability/logging/app-logger.service.ts',
    owner: 'platform/observability',
    category: 'response-timestamp',
    rationale: 'structured logger emits operational log timestamps for observability only.',
  }),
  entry({
    path: 'src/notifications/outbox/notification-dispatcher.service.ts',
    owner: 'notifications/outbox',
    category: 'dispatcher-default',
    rationale:
      'notification dispatcher accepts injected now and uses fallback only for worker claim/retry scheduling.',
  }),
  entry({
    path: 'src/notifications/outbox/notification-outbox.repository.ts',
    owner: 'notifications/outbox',
    category: 'date-arithmetic',
    rationale: 'notification outbox lease cutoff is derived from explicit dispatcher now input.',
  }),
  entry({
    path: 'src/notifications/queries/notification-list-cursor.ts',
    owner: 'notifications/queries',
    category: 'parser',
    rationale:
      'notification cursor decodes an ISO timestamp string; it does not create source-of-truth time.',
  }),
  entry({
    path: 'src/notices/queries/global-notice-list.cursor.ts',
    owner: 'notices/queries',
    category: 'parser',
    rationale:
      'global notice cursor decodes an ISO timestamp string; it does not create source-of-truth time.',
  }),
  entry({
    path: 'src/platform/database/prisma.service.ts',
    owner: 'platform/database',
    category: 'business-db-now',
    rationale:
      'PrismaService.getDatabaseNow() is the canonical DB timestamp wrapper and parses DB row values.',
  }),
  entry({
    path: 'src/platform/http/api-exception.filter.ts',
    owner: 'platform/http',
    category: 'response-timestamp',
    rationale: 'exception timestamp is response metadata only and is not persisted business time.',
  }),
  entry({
    path: 'src/platform/time/kst-date.ts',
    owner: 'platform/time',
    category: 'date-arithmetic',
    rationale:
      'KST helper converts explicit dates and local date strings without owning product time policy.',
  }),
  entry({
    path: 'src/retention/access-logs/create-retention-access-log.command.ts',
    owner: 'retention/access-logs',
    category: 'date-arithmetic',
    rationale:
      'access log creation accepts createdAt and derives retention hold dates from that explicit value.',
  }),
  entry({
    path: 'src/retention/archive-jobs/archive-job-transition.policy.ts',
    owner: 'retention/archive-jobs',
    category: 'date-arithmetic',
    rationale: 'archive retry scheduling is derived from explicit worker now input.',
  }),
  entry({
    path: 'src/retention/archive-jobs/archive-job.payload.ts',
    owner: 'retention/archive-jobs',
    category: 'parser',
    rationale:
      'archive payload parsing and hold-date calculation operate on explicit payload dates.',
  }),
  entry({
    path: 'src/retention/archive-jobs/archive-job.repository.ts',
    owner: 'retention/archive-jobs',
    category: 'date-arithmetic',
    rationale: 'archive job claim lease is derived from explicit worker now input.',
  }),
  entry({
    path: 'src/retention/observability/retention-alerts.ts',
    owner: 'retention/observability',
    category: 'response-timestamp',
    rationale:
      'retention alert timestamp is operational telemetry and accepts an injectable occurredAt.',
  }),
  entry({
    path: 'src/retention/retained-identities/retained-identity-decision.policy.ts',
    owner: 'retention/retained-identities',
    category: 'date-arithmetic',
    rationale: 'retained identity hold dates are derived from explicit deletion date input.',
  }),
  entry({
    path: 'src/retention/retained-identities/retained-identity-disclosure.service.ts',
    owner: 'retention/retained-identities',
    category: 'date-arithmetic',
    rationale:
      'retained identity disclosure accepts now and passes it through to access-log creation.',
  }),
  entry({
    path: 'src/retention/review-jobs/retention-review-job-runner.service.ts',
    owner: 'retention/review-jobs',
    category: 'date-arithmetic',
    rationale: 'retention review job claim lease is derived from explicit worker now input.',
  }),
  entry({
    path: 'src/retention/review-jobs/retention-review-job-transition.policy.ts',
    owner: 'retention/review-jobs',
    category: 'date-arithmetic',
    rationale: 'retention review retry scheduling is derived from explicit worker now input.',
  }),
  entry({
    path: 'src/retention/vault/retained-vault.service.ts',
    owner: 'retention/vault',
    category: 'date-arithmetic',
    rationale:
      'retained vault disclosure/disposal accepts now and derives retention dates from explicit inputs.',
  }),
  entry({
    path: 'src/seasons/operations/clear-season-override.command.ts',
    owner: 'seasons/operations',
    category: 'parser',
    rationale: 'operation command parses expectedUpdatedAt for optimistic concurrency input only.',
  }),
  entry({
    path: 'src/seasons/operations/season-operational-metrics.service.ts',
    owner: 'seasons/operations',
    category: 'response-timestamp',
    rationale:
      'season operational metrics timestamp is operator-facing telemetry and accepts recordedAt input.',
  }),
  entry({
    path: 'src/seasons/operations/season-operations.policy.ts',
    owner: 'seasons/operations',
    category: 'parser',
    rationale: 'season operations policy parses request timestamps to validate schedule ordering.',
  }),
  entry({
    path: 'src/seasons/operations/update-season-override.command.ts',
    owner: 'seasons/operations',
    category: 'parser',
    rationale: 'operation command parses override and expectedUpdatedAt request fields.',
  }),
  entry({
    path: 'src/seasons/operations/update-season-schedule.command.ts',
    owner: 'seasons/operations',
    category: 'parser',
    rationale: 'operation command parses schedule dates and expectedUpdatedAt request fields.',
  }),
  entry({
    path: 'src/seasons/runtime/current-season-context.query.ts',
    owner: 'seasons/runtime',
    category: 'duration-metric',
    rationale: 'current season context query measures elapsed duration for query telemetry only.',
  }),
  entry({
    path: 'src/seasons/runtime/season-runtime.policy.ts',
    owner: 'seasons/runtime',
    category: 'parser',
    rationale:
      'runtime policy parses persisted override timestamps for comparison against explicit reference time.',
  }),
  entry({
    path: 'src/season-participants/profile-history/get-previous-season-profile.query.ts',
    owner: 'season-participants/profile-history',
    category: 'date-arithmetic',
    rationale:
      'previous profile query derives ended-season lookup windows from explicit query now input.',
  }),
  entry({
    path: 'src/social-safety/blocks/queries/block-list.query.ts',
    owner: 'social-safety/blocks',
    category: 'parser',
    rationale:
      'block list cursor decodes an ISO timestamp string; it does not create source-of-truth time.',
  }),
  entry({
    path: 'src/social-safety/bookmarks/queries/bookmark-list.query.ts',
    owner: 'social-safety/bookmarks',
    category: 'parser',
    rationale:
      'bookmark list cursor decodes an ISO timestamp string; it does not create source-of-truth time.',
  }),
  entry({
    path: 'src/support/queries/support-ticket-list.cursor.ts',
    owner: 'support/queries',
    category: 'parser',
    rationale:
      'support ticket cursor decodes an ISO timestamp string; it does not create source-of-truth time.',
  }),
  entry({
    path: 'src/users/identity/academic/academic-college-change-allowance.repository.ts',
    owner: 'users/identity/academic',
    category: 'date-arithmetic',
    rationale: 'college-change allowance derives a date-only cutoff from explicit now input.',
  }),
];

const sqlTimeUsageInventory: readonly SqlTimeInventoryEntry[] = [
  sqlEntry({
    path: 'prisma/sql/getActiveLoginLock.sql',
    owner: 'auth/login-attempts',
    rationale: 'login lock remaining time and active lock predicate are DB-time based.',
  }),
  sqlEntry({
    path: 'prisma/sql/getActiveVerificationRecord.sql',
    owner: 'auth/verification',
    rationale: 'active verification lookup uses DB CURRENT_TIMESTAMP for expiry.',
  }),
  sqlEntry({
    path: 'prisma/sql/getCurrentTimestamp.sql',
    owner: 'platform/database',
    rationale: 'canonical DB now helper used by PrismaService.getDatabaseNow().',
  }),
  sqlEntry({
    path: 'prisma/sql/getVerificationBackstopRetryAfterSeconds.sql',
    owner: 'auth/verification',
    rationale: 'verification backstop cooldown window is filtered with DB CURRENT_TIMESTAMP.',
  }),
  sqlEntry({
    path: 'prisma/sql/getVerificationRetryAfterSeconds.sql',
    owner: 'auth/verification',
    rationale: 'verification cooldown retry-after is calculated against DB CURRENT_TIMESTAMP.',
  }),
  sqlEntry({
    path: 'prisma/sql/markVerificationCodeVerified.sql',
    owner: 'auth/verification',
    rationale: 'verification success stamps verifiedAt with DB CURRENT_TIMESTAMP inside SQL.',
  }),
  sqlEntry({
    path: 'prisma/sql/recordLoginFailure.sql',
    owner: 'auth/login-attempts',
    rationale: 'login failure attempts and lockout timestamps are stamped with DB NOW().',
  }),
  sqlEntry({
    path: 'prisma/sql/recordVerificationCodeFailure.sql',
    owner: 'auth/verification',
    rationale: 'verification failure consume/expiry logic is evaluated with DB CURRENT_TIMESTAMP.',
  }),
];

function entry(input: TimeSourceInventoryEntry): TimeSourceInventoryEntry {
  return input;
}

function sqlEntry(input: SqlTimeInventoryEntry): SqlTimeInventoryEntry {
  return input;
}

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
