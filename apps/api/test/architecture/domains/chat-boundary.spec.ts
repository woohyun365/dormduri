import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const chatRoot = join(apiSourceRoot, 'chat');
const chatEventsRoot = join(chatRoot, 'events');
const chatLifecycleEventsRoot = join(chatRoot, 'lifecycle-events');
const notificationsRoot = join(apiSourceRoot, 'notifications');
const sqlRoot = join(apiRoot, 'prisma/sql');
const prismaSchemaPath = join(apiRoot, 'prisma/schema.prisma');
const baselineMigrationPath = join(
  apiRoot,
  'prisma/migrations/000000000000_initial_baseline/migration.sql',
);

function walkTypeScriptFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      return walkTypeScriptFiles(path);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });
}

function productionTypeScriptFiles(root: string): string[] {
  return walkTypeScriptFiles(root).filter((path) => !path.endsWith('.spec.ts'));
}

function runtimeProductionTypeScriptFiles(root: string): string[] {
  return productionTypeScriptFiles(root).filter((path) => !path.includes('/test-support/'));
}

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function relativeSourcePath(path: string) {
  return relative(apiRoot, path);
}

describe('chat architecture boundary', () => {
  it('keeps social-safety block side-effect as a port contract, not ChatService growth', () => {
    const portSource = readSource(
      join(chatRoot, 'application/ports/chat-block-side-effect.port.ts'),
    );
    const chatServiceSource = readSource(join(chatRoot, 'application/chat.service.ts'));
    const chatGodSpecSource = readSource(join(chatRoot, 'application/chat.service.spec.ts'));

    expect(portSource).toContain('CHAT_BLOCK_SIDE_EFFECT_PORT');
    expect(portSource).toContain('closeDirectThreadsForBlock');
    expect(chatServiceSource).not.toMatch(
      /closeDirectThreadsForBlock|USER_BLOCKED|BLOCKED_BY_USER/,
    );
    expect(chatGodSpecSource).not.toMatch(
      /ChatBlockSideEffect|closeDirectThreadsForBlock|USER_BLOCKED|BLOCKED_BY_USER/,
    );
  });

  it('keeps ChatService spec as a facade smoke spec instead of a god spec', () => {
    const chatServiceSpecSource = readSource(join(chatRoot, 'application/chat.service.spec.ts'));

    expect(chatServiceSpecSource).toContain('ChatService facade');
    expect(chatServiceSpecSource).not.toMatch(
      /advisory lock|idempotent retry|read marker는|archive가 아닌 visible thread/,
    );
  });

  it('keeps realtime/outbox dependency direction away from application facade coupling', () => {
    const outboxRealtimeImports = productionTypeScriptFiles(join(chatRoot, 'outbox')).filter(
      (path) => /from\s+['"].*realtime\//.test(readSource(path)),
    );
    const realtimeChatServiceImports = productionTypeScriptFiles(join(chatRoot, 'realtime')).filter(
      (path) => /from\s+['"].*(application\/chat\.service|chat\.service)/.test(readSource(path)),
    );

    expect(outboxRealtimeImports.map(relativeSourcePath)).toEqual([]);
    expect(realtimeChatServiceImports.map(relativeSourcePath)).toEqual([]);
  });

  it('keeps conversation thread lifecycle event trace in an internal lifecycle-events owner', () => {
    const expectedLifecycleEventOwnerFiles = [
      'conversation-thread-lifecycle-event.payload.policy.ts',
      'conversation-thread-lifecycle-event.repository.ts',
      'conversation-thread-lifecycle-event.types.ts',
      'conversation-thread-lifecycle-event.writer.ts',
    ];
    const missingLifecycleEventOwnerFiles = expectedLifecycleEventOwnerFiles.filter(
      (file) => !existsSync(join(chatLifecycleEventsRoot, file)),
    );
    const realtimeEventOwnerLeaks = productionTypeScriptFiles(chatEventsRoot).filter((path) =>
      /ConversationThreadLifecycleEvent|LifecycleEventWriter|LifecycleEventRepository|lifecycle-event\.payload/.test(
        readSource(path),
      ),
    );
    const lifecycleEventOutboxCouplings = productionTypeScriptFiles(chatLifecycleEventsRoot).filter(
      (path) =>
        /from\s+['"].*(?:\.\.\/outbox|chat\/outbox)|ChatRealtimeOutbox|claimChatRealtime|Replay/.test(
          readSource(path),
        ),
    );
    const exportsSource = readSource(join(chatRoot, 'composition/chat.exports.ts'));

    expect(existsSync(chatLifecycleEventsRoot)).toBe(true);
    expect(missingLifecycleEventOwnerFiles).toEqual([]);
    expect(realtimeEventOwnerLeaks.map(relativeSourcePath)).toEqual([]);
    expect(lifecycleEventOutboxCouplings.map(relativeSourcePath)).toEqual([]);
    expect(exportsSource).not.toMatch(
      /ConversationThreadLifecycleEvent(?:Writer|Repository)|CHAT_THREAD_LIFECYCLE_EVENT/,
    );
  });

  it('keeps conversation thread lifecycle event as append-only audit trace, not a read-model source', () => {
    const repositorySource = readSource(
      join(chatLifecycleEventsRoot, 'conversation-thread-lifecycle-event.repository.ts'),
    );
    const writerSource = readSource(
      join(chatLifecycleEventsRoot, 'conversation-thread-lifecycle-event.writer.ts'),
    );
    const readPathRoots = ['queries', 'pairs', 'mappers', 'events', 'realtime', 'outbox'].map(
      (directory) => join(chatRoot, directory),
    );
    const lifecycleReadModelUsers = readPathRoots.flatMap((root) =>
      runtimeProductionTypeScriptFiles(root).filter((path) =>
        /conversationThreadLifecycleEvent|ConversationThreadLifecycleEvent(?:Writer|Repository)|lifecycle-events\//.test(
          readSource(path),
        ),
      ),
    );

    expect(repositorySource).toContain('tx.conversationThreadLifecycleEvent.create');
    expect(repositorySource).not.toMatch(
      /conversationThreadLifecycleEvent\.(?:findFirst|findMany|findUnique|update|updateMany|delete|deleteMany|upsert)/,
    );
    expect(writerSource).not.toMatch(/findFirst|findMany|findUnique|update|delete|upsert/);
    expect(lifecycleReadModelUsers.map(relativeSourcePath)).toEqual([]);
  });

  it('keeps realtime delivery on ChatRealtimeOutboxEvent instead of lifecycle events', () => {
    const schemaSource = readSource(prismaSchemaPath);
    const realtimeSources = runtimeProductionTypeScriptFiles(join(chatRoot, 'realtime')).map(
      readSource,
    );
    const outboxSources = runtimeProductionTypeScriptFiles(join(chatRoot, 'outbox')).map(
      readSource,
    );
    const lifecycleEventSources =
      runtimeProductionTypeScriptFiles(chatLifecycleEventsRoot).map(readSource);

    expect(schemaSource).toContain('model ChatRealtimeOutboxEvent');
    expect(outboxSources.join('\n')).toContain('ChatRealtimeOutboxEvent');
    expect(realtimeSources.join('\n')).toContain('ClaimedChatRealtimeOutboxEvent');
    expect(lifecycleEventSources.join('\n')).not.toMatch(
      /ChatRealtimeOutboxEvent|chat\.thread\.|chat\.message\.|roomKeys|recipientUserIds/,
    );
  });

  it('does not introduce a ConversationThreadRetentionState model or baseline table', () => {
    const schemaSource = readSource(prismaSchemaPath);
    const baselineMigrationSource = readSource(baselineMigrationPath);

    expect(schemaSource).not.toContain('ConversationThreadRetentionState');
    expect(baselineMigrationSource).not.toContain('ConversationThreadRetentionState');
    expect(schemaSource).toContain('model ArchiveJob');
    expect(schemaSource).toContain('model RetainedVaultObject');
    expect(schemaSource).toContain('model RetentionCase');
    expect(schemaSource).toContain('model RetentionReviewJob');
  });

  it('keeps chat and notification PostgreSQL static queries on TypedSQL assets', () => {
    const expectedSqlFiles = [
      'claimChatRealtimeOutboxEvents.sql',
      'findChatRealtimeOutboxRecipients.sql',
      'findChatRealtimeReplayCursor.sql',
      'findChatRealtimeReplayEvents.sql',
      'pruneExpiredChatRealtimeOutboxEvents.sql',
      'claimNotificationOutboxEvents.sql',
    ];
    const missingSqlFiles = expectedSqlFiles.filter((file) => !existsSync(join(sqlRoot, file)));
    const unsafeRawQueryUsers = [
      ...productionTypeScriptFiles(chatRoot),
      ...productionTypeScriptFiles(notificationsRoot),
    ].filter((path) => readSource(path).includes('$queryRawUnsafe'));

    expect(missingSqlFiles).toEqual([]);
    expect(unsafeRawQueryUsers.map(relativeSourcePath)).toEqual([]);
    expect(readSource(join(chatRoot, 'outbox/chat-realtime-outbox.repository.ts'))).toContain(
      '$queryRawTyped',
    );
    expect(
      readSource(join(notificationsRoot, 'outbox/notification-outbox.repository.ts')),
    ).toContain('$queryRawTyped');
  });
});
