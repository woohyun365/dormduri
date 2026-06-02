import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const apiRoot = process.cwd();
const chatRoot = join(apiRoot, 'src/chat');
const notificationsRoot = join(apiRoot, 'src/notifications');
const sqlRoot = join(apiRoot, 'prisma/sql');

function walkTypeScriptFiles(root: string): string[] {
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

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function relativeSourcePath(path: string) {
  return relative(apiRoot, path);
}

describe('Phase 6-1.7 chat architecture boundary', () => {
  it('keeps chat root production files limited to adapter/composition entrypoints', () => {
    const rootProductionFiles = readdirSync(chatRoot)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .sort();

    expect(rootProductionFiles).toEqual(['chat.controller.ts', 'chat.module.ts']);
  });

  it('keeps legacy owner/cluster root files removed after responsibility split', () => {
    const legacyFiles = [
      'chat-command-cluster.ts',
      'chat-context-owner.ts',
      'chat-query-owner.ts',
      'chat-selects.ts',
      'chat-thread-support.ts',
      'chat-transaction-helpers.ts',
      'chat.errors.ts',
      'realtime/chat-realtime-event.mapper.ts',
    ];

    expect(legacyFiles.filter((file) => existsSync(join(chatRoot, file)))).toEqual([]);
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
