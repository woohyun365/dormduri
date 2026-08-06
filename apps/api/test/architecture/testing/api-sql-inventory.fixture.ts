export const forbiddenRawSqlPattern = /\.\$(?:queryRaw|executeRaw)(?:Unsafe)?\s*(?:<|\(|`)/;
export const unsafeTypedSqlPayloadPattern = /\.\$queryRawTyped\s*(?:<[^>]*>)?\s*\(\s*(?:`|'|")/;
export const forbiddenSessionAdvisoryLockPattern =
  /\bpg_(?:try_)?advisory_lock\s*\(|\bpg_advisory_unlock/i;
export const transactionAdvisoryLockPattern = /\bpg_advisory_xact_lock\s*\(/i;
export const skipLockedPattern = /\bFOR\s+UPDATE\s+SKIP\s+LOCKED\b/i;
export const sqlTimePattern = /\bCURRENT_TIMESTAMP\b|\bNOW\s*\(/i;

export const allowedSqlAssetCategories = [
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

export const sqlAssetInventory: readonly SqlAssetInventoryEntry[] = [
  sqlEntry({
    path: 'prisma/sql/acquireTransactionAdvisoryLock.sql',
    owner: 'platform/database',
    category: 'transaction-lock',
    requiredPatterns: [transactionAdvisoryLockPattern, /hashtext\(\$1\)/i, /hashtext\(\$2\)/i],
    rationale: 'shared advisory lock helper is transaction-scoped and never session-scoped.',
  }),
  sqlEntry({
    path: 'prisma/sql/claimAuthMailOutboxEvents.sql',
    owner: 'auth/mail',
    category: 'worker-claim',
    requiredPatterns: [
      /FROM\s+"AuthMailOutboxEvent"/i,
      /ORDER\s+BY\s+"availableAt"\s+ASC,\s*"createdAt"\s+ASC,\s*"id"\s+ASC/i,
      /LIMIT\s+\$4/i,
      skipLockedPattern,
      /"lockedAt"\s+=\s+\$1/i,
      /"lockedBy"\s+=\s+\$3/i,
      /"updatedAt"\s+=\s+\$1/i,
    ],
    rationale: 'auth mail dispatcher uses a bounded SKIP LOCKED lease claim.',
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
      /"codeExpiresAt"\s+>\s+CURRENT_TIMESTAMP/i,
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
    requiredPatterns: [
      /EXTRACT\s*\(\s*EPOCH\s+FROM\s+CURRENT_TIMESTAMP\s*\)/i,
      /DOUBLE\s+PRECISION\s+AS\s+"epochSeconds"/i,
    ],
    rationale:
      'canonical database timestamp helper returns an adapter-timezone-independent epoch value.',
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
      /"codeExpiresAt"\s+>\s+CURRENT_TIMESTAMP/i,
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
      /ORDER\s+BY\s+COALESCE\("consumedAt",\s*"codeExpiresAt"\)\s+ASC,\s*id\s+ASC/i,
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
      /"codeExpiresAt"\s+>\s+CURRENT_TIMESTAMP/i,
      /RETURNING\s+"failedAttempts",\s*"consumedAt"/i,
    ],
    rationale: 'verification failure consumes exhausted records with DB time and expiry checks.',
  }),
];

function sqlEntry(input: SqlAssetInventoryEntry): SqlAssetInventoryEntry {
  return input;
}
