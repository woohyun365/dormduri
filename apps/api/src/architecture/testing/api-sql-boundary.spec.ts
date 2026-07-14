import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = process.cwd();
const sourceRoot = join(apiRoot, 'src');
const sqlRoot = join(apiRoot, 'prisma', 'sql');
const generatedSqlRoot = join(apiRoot, 'src', 'generated', 'prisma', 'sql');
const generatedSqlIndexPath = join(apiRoot, 'src', 'generated', 'prisma', 'sql.ts');

const forbiddenRawSqlPattern = /\.\$(?:queryRaw|executeRaw)(?:Unsafe)?\s*(?:<|\(|`)/;
const unsafeTypedSqlPayloadPattern = /\.\$queryRawTyped\s*(?:<[^>]*>)?\s*\(\s*(?:`|'|")/;
const forbiddenSessionAdvisoryLockPattern =
  /\bpg_(?:try_)?advisory_lock\s*\(|\bpg_advisory_unlock/i;
const transactionAdvisoryLockPattern = /\bpg_advisory_xact_lock\s*\(/i;
const skipLockedPattern = /\bFOR\s+UPDATE\s+SKIP\s+LOCKED\b/i;
const sqlTimePattern = /\bCURRENT_TIMESTAMP\b|\bNOW\s*\(/i;

const allowedSqlAssetCategories = [
  'cleanup-delete',
  'db-time',
  'row-lock',
  'transaction-lock',
  'typedsql-query',
  'worker-claim',
] as const;

type SqlAssetCategory = (typeof allowedSqlAssetCategories)[number];

interface SqlAssetInventoryEntry {
  path: string;
  owner: string;
  category: SqlAssetCategory;
  requiredPatterns: readonly RegExp[];
  rationale: string;
}

const sqlAssetInventory: readonly SqlAssetInventoryEntry[] = [
  sqlEntry({
    path: 'prisma/sql/acquireTransactionAdvisoryLock.sql',
    owner: 'platform/database',
    category: 'transaction-lock',
    requiredPatterns: [transactionAdvisoryLockPattern, /hashtext\(\$1\)/i, /hashtext\(\$2\)/i],
    rationale: 'shared advisory lock helper is transaction-scoped and never session-scoped.',
  }),
  sqlEntry({
    path: 'prisma/sql/claimChatRealtimeOutboxEvents.sql',
    owner: 'chat/outbox',
    category: 'worker-claim',
    requiredPatterns: [
      /FROM\s+"ChatRealtimeOutboxEvent"/i,
      /ORDER\s+BY\s+"availableAt"\s+ASC,\s*"occurredAt"\s+ASC,\s*"id"\s+ASC/i,
      /LIMIT\s+\$3/i,
      skipLockedPattern,
      /SET\s+"availableAt"\s+=\s+\$2/i,
      /"publishAttempts"\s+=\s+event\."publishAttempts"\s+\+\s+1/i,
    ],
    rationale:
      'chat realtime dispatcher claims bounded publishable events without double-claiming rows.',
  }),
  sqlEntry({
    path: 'prisma/sql/claimNotificationOutboxEvents.sql',
    owner: 'notifications/outbox',
    category: 'worker-claim',
    requiredPatterns: [
      /FROM\s+"NotificationOutboxEvent"/i,
      /ORDER\s+BY\s+"availableAt"\s+ASC,\s*"createdAt"\s+ASC,\s*"id"\s+ASC/i,
      /LIMIT\s+\$4/i,
      skipLockedPattern,
      /"lockedAt"\s+=\s+\$1/i,
      /"lockedBy"\s+=\s+\$3/i,
    ],
    rationale: 'notification dispatcher uses a bounded SKIP LOCKED lease claim.',
  }),
  sqlEntry({
    path: 'prisma/sql/claimRetentionArchiveJobs.sql',
    owner: 'retention/archive-jobs',
    category: 'worker-claim',
    requiredPatterns: [
      /FROM\s+"ArchiveJob"/i,
      /ORDER\s+BY\s+"nextRunAt"\s+ASC,\s*"createdAt"\s+ASC,\s*"id"\s+ASC/i,
      /LIMIT\s+\$3/i,
      skipLockedPattern,
      /"nextRunAt"\s+=\s+\$2/i,
      /"lastAttemptAt"\s+=\s+\$1/i,
    ],
    rationale: 'retention archive jobs are claimed in bounded deterministic batches.',
  }),
  sqlEntry({
    path: 'prisma/sql/claimRetentionReviewJobs.sql',
    owner: 'retention/review-jobs',
    category: 'worker-claim',
    requiredPatterns: [
      /FROM\s+"RetentionReviewJob"/i,
      /ORDER\s+BY\s+"dueAt"\s+ASC,\s*"createdAt"\s+ASC,\s*"id"\s+ASC/i,
      /LIMIT\s+\$3/i,
      skipLockedPattern,
      /"dueAt"\s+=\s+\$2/i,
      /"lastAttemptAt"\s+=\s+\$1/i,
    ],
    rationale: 'retention review jobs are claimed in bounded deterministic batches.',
  }),
  sqlEntry({
    path: 'prisma/sql/consumeVerificationCodeProof.sql',
    owner: 'auth/verification',
    category: 'db-time',
    requiredPatterns: [/UPDATE\s+"VerificationCode"/i, /"expiresAt"\s+>\s+CURRENT_TIMESTAMP/i],
    rationale: 'verification proof consume keeps expiry checks in DB time.',
  }),
  sqlEntry({
    path: 'prisma/sql/disposeDueRetentionAccessLogs.sql',
    owner: 'retention/access-logs',
    category: 'worker-claim',
    requiredPatterns: [
      /FROM\s+"RetentionAccessLog"/i,
      /ORDER\s+BY\s+"logRetentionHoldUntil"\s+ASC,\s*"id"\s+ASC/i,
      /LIMIT\s+\$2/i,
      skipLockedPattern,
      /"logRetentionDisposedAt"\s+=\s+\$1/i,
      /"disclosedFields"\s+=\s+'null'::jsonb/i,
    ],
    rationale:
      'retention access-log disposal claims bounded rows and minimizes disclosure metadata atomically.',
  }),
  sqlEntry({
    path: 'prisma/sql/findChatRealtimeOutboxRecipients.sql',
    owner: 'chat/outbox',
    category: 'typedsql-query',
    requiredPatterns: [
      /FROM\s+"ChatRealtimeEventRecipient"/i,
      /WHERE\s+"eventId"\s+=\s+\$1/i,
      /ORDER\s+BY\s+"userId"\s+ASC/i,
    ],
    rationale: 'chat realtime recipient lookup stays in generated TypedSQL.',
  }),
  sqlEntry({
    path: 'prisma/sql/findChatRealtimeReplayCursor.sql',
    owner: 'chat/outbox',
    category: 'typedsql-query',
    requiredPatterns: [
      /FROM\s+"ChatRealtimeEventRecipient"/i,
      /WHERE\s+"userId"\s+=\s+\$1/i,
      /LIMIT\s+1/i,
    ],
    rationale: 'chat realtime replay cursor lookup stays in generated TypedSQL.',
  }),
  sqlEntry({
    path: 'prisma/sql/findChatRealtimeReplayEvents.sql',
    owner: 'chat/outbox',
    category: 'typedsql-query',
    requiredPatterns: [
      /FROM\s+"ChatRealtimeEventRecipient"\s+AS\s+recipient/i,
      /INNER\s+JOIN\s+"ChatRealtimeOutboxEvent"/i,
      /ORDER\s+BY\s+recipient\."createdAt"\s+ASC,\s*recipient\."eventId"\s+ASC/i,
      /LIMIT\s+\$6/i,
    ],
    rationale: 'chat realtime replay listing stays ordered, bounded, and generated.',
  }),
  sqlEntry({
    path: 'prisma/sql/findActiveChatThreadSearchMetadata.sql',
    owner: 'chat/queries',
    category: 'typedsql-query',
    requiredPatterns: [
      /FROM\s+"ConversationThread"\s+AS\s+conversation/i,
      /INNER\s+JOIN\s+"ConversationThreadMember"\s+AS\s+viewer_member/i,
      /viewer_member\."memberState"\s+=\s+'ACTIVE'::"ConversationThreadMemberState"/i,
      /target_member\."memberState"\s+=\s+'ACTIVE'::"ConversationThreadMemberState"/i,
      /conversation\."status"\s+=\s+'OPEN'::"ConversationThreadStatus"/i,
      /ANY\(\$3::text\[\]\)/i,
    ],
    rationale:
      'roommate-search summary decorates visible candidates with active OPEN chat thread state through a chat-owned generated TypedSQL query.',
  }),
  sqlEntry({
    path: 'prisma/sql/findDirectionLimitReachedMatchRequestSearchMetadata.sql',
    owner: 'matches/requests',
    category: 'typedsql-query',
    requiredPatterns: [
      /FROM\s+"MatchRequest"/i,
      /"requesterParticipantId"\s+=\s+\$2/i,
      /"receiverParticipantId"\s+=\s+ANY\(\$3::text\[\]\)/i,
      /GROUP\s+BY\s+request\."receiverParticipantId"/i,
      /HAVING\s+COUNT\(\*\)\s+>=\s+5/i,
    ],
    rationale:
      'roommate-search summary decorates visible candidates whose viewer-to-target direction has exhausted match-request attempts without exposing unrelated pair history.',
  }),
  sqlEntry({
    path: 'prisma/sql/findPendingMatchRequestSearchMetadata.sql',
    owner: 'matches/requests',
    category: 'typedsql-query',
    requiredPatterns: [
      /FROM\s+"MatchRequest"/i,
      /"status"\s+=\s+'PENDING'::"MatchRequestStatus"/i,
      /"expiresAt"\s+>\s+\$4/i,
      /ANY\(\$3::text\[\]\)/i,
      /ORDER\s+BY\s+request\."createdAt"\s+DESC,\s*request\."id"\s+DESC/i,
    ],
    rationale:
      'roommate-search summary decorates visible candidates with live pending match-request direction through a bounded generated TypedSQL query.',
  }),
  sqlEntry({
    path: 'prisma/sql/getActiveLoginLock.sql',
    owner: 'auth/login-attempts',
    category: 'db-time',
    requiredPatterns: [
      /CURRENT_TIMESTAMP/i,
      /"lockedUntil"\s+>\s+CURRENT_TIMESTAMP/i,
      /LIMIT\s+1/i,
    ],
    rationale: 'login lock remaining seconds and active predicate are evaluated with DB time.',
  }),
  sqlEntry({
    path: 'prisma/sql/getActiveVerificationRecord.sql',
    owner: 'auth/verification',
    category: 'db-time',
    requiredPatterns: [
      /"expiresAt"\s+>\s+CURRENT_TIMESTAMP/i,
      /ORDER\s+BY\s+"issuedAt"\s+DESC/i,
      /LIMIT\s+1/i,
    ],
    rationale:
      'active verification lookup uses DB time expiry and deterministic latest-code ordering.',
  }),
  sqlEntry({
    path: 'prisma/sql/getCurrentTimestamp.sql',
    owner: 'platform/database',
    category: 'db-time',
    requiredPatterns: [/SELECT\s+CURRENT_TIMESTAMP\s+AS\s+"now"/i],
    rationale: 'canonical database timestamp helper for product persistence time.',
  }),
  sqlEntry({
    path: 'prisma/sql/getMigrationBaselineHealth.sql',
    owner: 'health/checks',
    category: 'typedsql-query',
    requiredPatterns: [
      /FROM\s+"_prisma_migrations"/i,
      /COUNT\(\*\)\s+FILTER\s+\(WHERE\s+rolled_back_at\s+IS\s+NOT\s+NULL\)::int\s+AS\s+failed_count/i,
      /COUNT\(\*\)\s+FILTER\s+\(WHERE\s+finished_at\s+IS\s+NULL\s+AND\s+rolled_back_at\s+IS\s+NULL\)::int\s+AS\s+incomplete_count/i,
    ],
    rationale:
      'health readiness inspects Prisma migration metadata through generated TypedSQL instead of direct raw SQL.',
  }),
  sqlEntry({
    path: 'prisma/sql/getLatestVerifiedResetCode.sql',
    owner: 'auth/verification',
    category: 'db-time',
    requiredPatterns: [
      /purpose\s+=\s+'RESET_PASSWORD'::"VerificationCodePurpose"/i,
      /"expiresAt"\s+>\s+CURRENT_TIMESTAMP/i,
      /ORDER\s+BY\s+"issuedAt"\s+DESC/i,
    ],
    rationale: 'reset proof lookup uses DB-time expiry and latest-code ordering.',
  }),
  sqlEntry({
    path: 'prisma/sql/getLatestVerifiedSignupCode.sql',
    owner: 'auth/verification',
    category: 'db-time',
    requiredPatterns: [
      /purpose\s+=\s+'SIGNUP'::"VerificationCodePurpose"/i,
      /"verifiedAt"\s+>\s+CURRENT_TIMESTAMP\s+-/i,
      /ORDER\s+BY\s+"issuedAt"\s+DESC/i,
    ],
    rationale: 'signup proof TTL is evaluated with DB time and latest-code ordering.',
  }),
  sqlEntry({
    path: 'prisma/sql/getVerificationBackstopRetryAfterSeconds.sql',
    owner: 'auth/verification',
    category: 'db-time',
    requiredPatterns: [
      /COUNT\(\*\)::int\s+AS\s+"requestCount"/i,
      /MIN\("createdAt"\)\s+AS\s+"oldestRequestAt"/i,
      /CURRENT_TIMESTAMP\s+-/i,
    ],
    rationale: 'verification backstop cooldown window is filtered by DB time.',
  }),
  sqlEntry({
    path: 'prisma/sql/getVerificationRetryAfterSeconds.sql',
    owner: 'auth/verification',
    category: 'db-time',
    requiredPatterns: [
      /"retryAfterSeconds"/i,
      /CURRENT_TIMESTAMP/i,
      /ORDER\s+BY\s+"createdAt"\s+DESC/i,
      /LIMIT\s+1/i,
    ],
    rationale:
      'verification retry-after is calculated against DB time and latest request ordering.',
  }),
  sqlEntry({
    path: 'prisma/sql/lockActiveMatchRow.sql',
    owner: 'matches/active',
    category: 'row-lock',
    requiredPatterns: [/FROM\s+"ActiveMatch"/i, /WHERE\s+id\s+=\s+\$1/i, /FOR\s+UPDATE/i],
    rationale: 'active match mutation paths explicitly lock the aggregate row.',
  }),
  sqlEntry({
    path: 'prisma/sql/lockMatchRequestRow.sql',
    owner: 'matches/requests',
    category: 'row-lock',
    requiredPatterns: [/FROM\s+"MatchRequest"/i, /WHERE\s+id\s+=\s+\$1/i, /FOR\s+UPDATE/i],
    rationale: 'match request mutation paths explicitly lock the aggregate row.',
  }),
  sqlEntry({
    path: 'prisma/sql/markVerificationCodeVerified.sql',
    owner: 'auth/verification',
    category: 'db-time',
    requiredPatterns: [
      /SET\s+"verifiedAt"\s+=\s+CURRENT_TIMESTAMP/i,
      /"expiresAt"\s+>\s+CURRENT_TIMESTAMP/i,
      /RETURNING\s+id/i,
    ],
    rationale: 'verification success timestamp and expiry are DB-time based.',
  }),
  sqlEntry({
    path: 'prisma/sql/pruneExpiredAuthSessions.sql',
    owner: 'auth/operations',
    category: 'cleanup-delete',
    requiredPatterns: [
      /FROM\s+"AuthSession"/i,
      /ORDER\s+BY\s+COALESCE\("revokedAt",\s*"expiresAt"\)\s+ASC,\s*id\s+ASC/i,
      /LIMIT\s+\$2::int/i,
      /DELETE\s+FROM\s+"AuthSession"/i,
    ],
    rationale: 'auth session cleanup deletes bounded deterministic batches.',
  }),
  sqlEntry({
    path: 'prisma/sql/pruneExpiredChatRealtimeOutboxEvents.sql',
    owner: 'chat/outbox',
    category: 'cleanup-delete',
    requiredPatterns: [
      /DELETE\s+FROM\s+"ChatRealtimeOutboxEvent"/i,
      /WHERE\s+"occurredAt"\s+<\s+\$1/i,
      /COUNT\(\*\)::int\s+AS\s+"deletedCount"/i,
    ],
    rationale: 'chat realtime outbox pruning keeps generated SQL ownership for cleanup.',
  }),
  sqlEntry({
    path: 'prisma/sql/pruneExpiredVerificationCodes.sql',
    owner: 'auth/operations',
    category: 'cleanup-delete',
    requiredPatterns: [
      /FROM\s+"VerificationCode"/i,
      /ORDER\s+BY\s+COALESCE\("consumedAt",\s*"expiresAt"\)\s+ASC,\s*id\s+ASC/i,
      /LIMIT\s+\$2::int/i,
      /DELETE\s+FROM\s+"VerificationCode"/i,
    ],
    rationale: 'verification code cleanup deletes bounded deterministic batches.',
  }),
  sqlEntry({
    path: 'prisma/sql/pruneOldAuthSecurityEvents.sql',
    owner: 'auth/operations',
    category: 'cleanup-delete',
    requiredPatterns: [
      /FROM\s+"AuthSecurityEvent"/i,
      /ORDER\s+BY\s+"createdAt"\s+ASC,\s*id\s+ASC/i,
      /LIMIT\s+\$2::int/i,
      /DELETE\s+FROM\s+"AuthSecurityEvent"/i,
    ],
    rationale: 'auth security event cleanup deletes bounded deterministic batches.',
  }),
  sqlEntry({
    path: 'prisma/sql/pruneOldLoginAttempts.sql',
    owner: 'auth/operations',
    category: 'cleanup-delete',
    requiredPatterns: [
      /FROM\s+"LoginAttempt"/i,
      /ORDER\s+BY\s+COALESCE\("lastFailedAt",\s*"updatedAt",\s*"createdAt"\)\s+ASC,\s*id\s+ASC/i,
      /LIMIT\s+\$2::int/i,
      /DELETE\s+FROM\s+"LoginAttempt"/i,
    ],
    rationale: 'login attempt cleanup deletes bounded deterministic batches.',
  }),
  sqlEntry({
    path: 'prisma/sql/pruneOldVerificationCodeRequestLogs.sql',
    owner: 'auth/operations',
    category: 'cleanup-delete',
    requiredPatterns: [
      /FROM\s+"VerificationCodeRequestLog"/i,
      /ORDER\s+BY\s+"createdAt"\s+ASC,\s*id\s+ASC/i,
      /LIMIT\s+\$2::int/i,
      /DELETE\s+FROM\s+"VerificationCodeRequestLog"/i,
    ],
    rationale: 'verification request-log cleanup deletes bounded deterministic batches.',
  }),
  sqlEntry({
    path: 'prisma/sql/recordLoginFailure.sql',
    owner: 'auth/login-attempts',
    category: 'db-time',
    requiredPatterns: [
      /INSERT\s+INTO\s+"LoginAttempt"/i,
      /NOW\(\)/i,
      /ON\s+CONFLICT\s+\("emailNormalized"\)/i,
      /"lockedUntil"\s+=\s+CASE/i,
    ],
    rationale: 'login failure count and lockout timestamps are stamped with DB NOW().',
  }),
  sqlEntry({
    path: 'prisma/sql/recordVerificationCodeFailure.sql',
    owner: 'auth/verification',
    category: 'db-time',
    requiredPatterns: [
      /UPDATE\s+"VerificationCode"/i,
      /CURRENT_TIMESTAMP/i,
      /"expiresAt"\s+>\s+CURRENT_TIMESTAMP/i,
      /RETURNING\s+"failedAttempts",\s*"consumedAt"/i,
    ],
    rationale: 'verification failure consumes exhausted records with DB time and expiry checks.',
  }),
];

function sqlEntry(input: SqlAssetInventoryEntry): SqlAssetInventoryEntry {
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
