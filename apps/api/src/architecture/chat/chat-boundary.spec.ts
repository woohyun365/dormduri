import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const chatRoot = join(apiSourceRoot, 'chat');
const notificationsRoot = join(apiSourceRoot, 'notifications');
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

describe('chat architecture boundary', () => {
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

  it('keeps ChatModule provider/export arrays in composition files', () => {
    const moduleSource = readSource(join(chatRoot, 'chat.module.ts'));
    const providersSource = readSource(join(chatRoot, 'composition/chat.providers.ts'));
    const exportsSource = readSource(join(chatRoot, 'composition/chat.exports.ts'));

    expect(moduleSource).toContain("import { CHAT_EXPORTS } from './composition/chat.exports.js'");
    expect(moduleSource).toContain(
      "import { CHAT_PROVIDERS } from './composition/chat.providers.js'",
    );
    expect(moduleSource).toContain('providers: CHAT_PROVIDERS');
    expect(moduleSource).toContain('exports: CHAT_EXPORTS');
    expect(moduleSource).not.toMatch(/providers:\s*\[/);
    expect(moduleSource).not.toMatch(/exports:\s*\[/);
    expect(providersSource).toContain('CHAT_REALTIME_PROVIDERS');
    expect(providersSource).toContain('CHAT_LIFECYCLE_PROVIDERS');
    expect(providersSource).toContain('CHAT_BLOCK_SIDE_EFFECT_PORT');
    expect(exportsSource).toContain('CHAT_BLOCK_SIDE_EFFECT_PORT');
    expect(exportsSource).toContain('CHAT_MATCH_THREAD_LIFECYCLE_PORT');
    expect(exportsSource).not.toMatch(/\bChatService\b|\bChatRealtimeMetricsService\b/);
  });

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
    const serviceSpecLineCount = chatServiceSpecSource.split(/\r?\n/).length;
    const ownerSpecPaths = [
      'commands/send-message.command.spec.ts',
      'commands/update-read-marker.command.spec.ts',
      'commands/leave-thread.command.spec.ts',
      'pairs/chat-pair-entry.query.spec.ts',
      'queries/chat-thread-query.service.spec.ts',
      'queries/chat-subscription-query.service.spec.ts',
      'outbox/chat-realtime-replay.service.spec.ts',
    ];

    expect(serviceSpecLineCount).toBeLessThanOrEqual(500);
    for (const ownerSpecPath of ownerSpecPaths) {
      expect(existsSync(join(chatRoot, ownerSpecPath))).toBe(true);
    }
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
