import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const notificationsRoot = join(apiSourceRoot, 'notifications');

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

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

function relativeSourcePath(path: string) {
  return relative(apiRoot, path);
}

function offendingFiles(root: string, forbidden: RegExp) {
  return productionTypeScriptFiles(root)
    .filter((path) => forbidden.test(readSource(path)))
    .map(relativeSourcePath)
    .sort();
}

describe('notifications architecture boundary', () => {
  it('keeps generic writer as the notification write source of truth', () => {
    const genericWriter = readSource(
      join(notificationsRoot, 'commands/create-notification.command.ts'),
    );
    const chatAdapter = readSource(
      join(notificationsRoot, 'commands/create-chat-thread-notification.command.ts'),
    );

    expect(genericWriter).toContain('appendNotification');
    expect(genericWriter).toContain('assertNotificationPayloadAllowed');
    expect(chatAdapter).toContain('NOTIFICATION_WRITER');
    expect(chatAdapter).not.toMatch(
      /userNotification\.(?:findUnique|create)|notificationOutboxEvent\.create/,
    );
  });

  it('keeps external domains away from notification internals', () => {
    const forbidden = /from\s+['"].*notifications\/(?:outbox|policies|mappers|commands)\//;

    expect(offendingFiles(join(apiSourceRoot, 'chat'), forbidden)).toEqual([]);
    expect(offendingFiles(join(apiSourceRoot, 'social-safety'), forbidden)).toEqual([]);
    expect(offendingFiles(join(apiSourceRoot, 'support'), forbidden)).toEqual([]);
  });
});
