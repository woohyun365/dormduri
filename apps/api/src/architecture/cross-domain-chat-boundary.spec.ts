import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const workspaceRoot = join(apiRoot, '../..');
const sharedSourceRoot = join(workspaceRoot, 'packages/shared/src');

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

const externalChatConsumerRoots = [
  'matches',
  'season-participants',
  'social-safety',
  'retention',
  'notifications',
  'lifecycle',
  'users',
  'profiles',
  'roommate-search',
  'dormitories',
  'seasons',
] as const;

describe('Phase 10C cross-domain chat architecture boundary', () => {
  it('keeps matches production code on chat lifecycle ports instead of concrete ChatService', () => {
    expect(
      offendingFiles(
        join(apiSourceRoot, 'matches'),
        /from\s+['"].*chat\/application\/chat\.service(?:\.js)?['"]|\bChatService\b/,
      ),
    ).toEqual([]);
  });

  it('keeps lifecycle sweep on the chat lifecycle sweep port', () => {
    expect(
      offendingFiles(
        join(apiSourceRoot, 'lifecycle'),
        /from\s+['"].*chat\/application\/chat\.service(?:\.js)?['"]|\bChatService\b/,
      ),
    ).toEqual([]);
  });

  it('keeps match history materialization independent from chat persistence', () => {
    const source = readSource(
      join(apiSourceRoot, 'matches/history/materialization/match-history-row.builder.ts'),
    );

    expect(source).not.toMatch(
      /\bConversationThread\b|\bConversationMessage\b|conversationThreads|lastMessageAt|hadConversation/,
    );
  });

  it('keeps shared match history contract independent from chat and notification contracts', () => {
    const source = readSource(join(sharedSourceRoot, 'match/contract/history.ts'));

    expect(source).not.toMatch(/from\s+['"].*(chat|notification|compat\/chat-contract)/);
  });

  it('does not introduce Nest forwardRef as a boundary workaround in production code', () => {
    expect(offendingFiles(apiSourceRoot, /\bforwardRef\s*\(/)).toEqual([]);
  });

  it('keeps season-participants production code from mutating chat persistence directly', () => {
    expect(
      offendingFiles(
        join(apiSourceRoot, 'season-participants'),
        /conversationThread\.(?:update|updateMany|create)|conversationMessage\./,
      ),
    ).toEqual([]);
  });

  it('keeps notifications production code on generic realtime ports instead of chat realtime concrete classes', () => {
    expect(
      offendingFiles(
        join(apiSourceRoot, 'notifications'),
        /from\s+['"].*(?:chat\/realtime|config\/chat-realtime\.config)|\bChatRealtimeMetricsService\b/,
      ),
    ).toEqual([]);
  });

  it('keeps ChatModule public exports on narrow ports instead of concrete facade/metrics classes', () => {
    const source = readSource(join(apiSourceRoot, 'chat/composition/chat.exports.ts'));

    expect(source).toContain('CHAT_MATCH_THREAD_LIFECYCLE_PORT');
    expect(source).toContain('CHAT_LIFECYCLE_SWEEP_PORT');
    expect(source).toContain('REALTIME_DISPATCH_METRICS_PORT');
    expect(source).not.toMatch(/\bChatService\b/);
    expect(source).not.toMatch(/\bChatRealtimeMetricsService\b/);
  });

  it('keeps future social-safety integration on chat ports instead of chat persistence or concrete services', () => {
    expect(
      existsSync(join(apiSourceRoot, 'chat/application/ports/chat-block-side-effect.port.ts')),
    ).toBe(true);
    expect(
      offendingFiles(
        join(apiSourceRoot, 'social-safety'),
        /from\s+['"].*chat\/application\/chat\.service(?:\.js)?['"]|\bChatService\b|conversationThread\.(?:create|update|updateMany|delete|deleteMany|upsert)|conversationMessage\./,
      ),
    ).toEqual([]);
    expect(
      offendingFiles(join(apiSourceRoot, 'chat'), /from\s+['"].*(?:social-safety|support)\//),
    ).toEqual([]);
  });

  it('keeps ChatService as a facade instead of direct chat table mutation/outbox owner', () => {
    const source = readSource(join(apiSourceRoot, 'chat/application/chat.service.ts'));

    expect(source).not.toMatch(
      /conversation(?:Thread|Message)\.(?:create|update|updateMany|delete|deleteMany|upsert)|ChatRealtimeOutboxService|append(?:Message|Thread)[A-Z]/,
    );
    expect(source).not.toMatch(/\bhandleActiveMatchCreated\b|\bhandleActiveMatchUnmatched\b/);
    expect(source).not.toMatch(/\bsweepThreadLifecycle\b/);
  });

  it('keeps lifecycle service filenames explicit for match/season responsibility', () => {
    expect(existsSync(join(apiSourceRoot, 'chat/lifecycle/chat-match-event.service.ts'))).toBe(
      false,
    );
    expect(existsSync(join(apiSourceRoot, 'chat/lifecycle/chat-lifecycle.service.ts'))).toBe(false);
    expect(
      existsSync(join(apiSourceRoot, 'chat/lifecycle/chat-match-thread-lifecycle.service.ts')),
    ).toBe(true);
    expect(existsSync(join(apiSourceRoot, 'chat/lifecycle/chat-season-lifecycle.service.ts'))).toBe(
      true,
    );
  });

  it('keeps the extracted send permission helper pure', () => {
    const source = readSource(
      join(apiSourceRoot, 'chat/policies/chat-thread-permission.policy.ts'),
    );

    expect(source).not.toMatch(
      /from\s+['"].*@nestjs|PrismaService|generated\/prisma|conversationThread|conversationMessage/,
    );
  });

  it('keeps an AI-readable chat architecture note with public boundary rules', () => {
    const readmePath = join(apiSourceRoot, 'chat/README.md');

    expect(existsSync(readmePath)).toBe(true);
    const source = readSource(readmePath);
    expect(source).toContain('CHAT_MATCH_THREAD_LIFECYCLE_PORT');
    expect(source).toContain('CHAT_THREAD_WITHDRAWAL_PORT');
    expect(source).toContain('ConversationThreadLifecycleEvent');
    expect(source).toContain('append-only audit/debug trace');
    expect(source).toContain('ChatRealtimeOutboxEvent');
    expect(source).toContain('ConversationThreadRetentionState');
    expect(source).toContain('외부 domain production code');
    expect(source).toContain('direct chat table mutation outside chat');
  });

  it('keeps conversation thread lifecycle event internals private to the chat owner', () => {
    const forbiddenLifecycleEventUsage =
      /from\s+['"].*chat\/lifecycle-events(?:\/|['"])|\bConversationThreadLifecycleEvent(?:Writer|Repository)\b|conversationThreadLifecycleEvent\.(?:create|update|updateMany|delete|deleteMany|upsert)/;
    const offenders = externalChatConsumerRoots.flatMap((root) =>
      offendingFiles(join(apiSourceRoot, root), forbiddenLifecycleEventUsage),
    );

    expect(offenders).toEqual([]);
  });
});
