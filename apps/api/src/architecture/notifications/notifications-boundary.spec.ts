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
  it('keeps notification root production files limited to controller/module', () => {
    const rootProductionFiles = readdirSync(notificationsRoot)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
      .sort();

    expect(rootProductionFiles).toEqual(['notifications.controller.ts', 'notifications.module.ts']);
  });

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

  it('keeps notification README as the source-of-truth map', () => {
    const source = readSource(join(notificationsRoot, 'README.md'));

    expect(source).toContain('## Public boundary');
    expect(source).toContain('## Directory responsibilities');
    expect(source).toContain('## Hard rules');
    expect(source).toContain('## Architecture guard');
    expect(source).toContain('NOTIFICATION_WRITER');
    expect(source).toContain('CHAT_THREAD_NOTIFICATION_WRITER');
    expect(source).toContain('PROFILE_MISMATCH_FEEDBACK');
    expect(source).toContain('OPERATOR_ALERT_SINK');
    expect(source).toContain('campaigns/');
    expect(source).toContain('OPERATOR_ALERT_DISCORD_WEBHOOK_URL');
    expect(source).toContain('notification_campaign_lag');
    expect(source).toContain('report detail, block note, support body');
  });
});
