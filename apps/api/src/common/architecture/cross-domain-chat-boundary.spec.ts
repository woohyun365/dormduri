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

describe('Phase 10C cross-domain chat architecture boundary', () => {
  it('keeps matches production code on chat lifecycle ports instead of concrete ChatService', () => {
    expect(
      offendingFiles(
        join(apiSourceRoot, 'matches'),
        /from\s+['"].*chat\/application\/chat\.service(?:\.js)?['"]|\bChatService\b/,
      ),
    ).toEqual([]);
  });

  it('keeps common lifecycle sweep on the chat lifecycle sweep port', () => {
    expect(
      offendingFiles(
        join(apiSourceRoot, 'common/lifecycle'),
        /from\s+['"].*chat\/application\/chat\.service(?:\.js)?['"]|\bChatService\b/,
      ),
    ).toEqual([]);
  });

  it('keeps match history materialization independent from chat persistence', () => {
    const source = readSource(
      join(apiSourceRoot, 'matches/match-history-materialization-owner.ts'),
    );

    expect(source).not.toMatch(
      /\bConversationThread\b|\bConversationMessage\b|conversationThreads|lastMessageAt|hadConversation/,
    );
  });

  it('keeps shared match history contract independent from chat and notification contracts', () => {
    const source = readSource(join(sharedSourceRoot, 'match-contract-history.ts'));

    expect(source).not.toMatch(/from\s+['"].*(chat|notification|compat\/chat-contract)/);
  });

  it('does not introduce Nest forwardRef as a boundary workaround in production code', () => {
    expect(offendingFiles(apiSourceRoot, /\bforwardRef\s*\(/)).toEqual([]);
  });

  it.todo(
    'Phase 10C.3: season-participants production code must stop mutating conversationThread/conversationMessage directly',
  );

  it.todo(
    'Phase 10C.4: notifications production code must stop importing chat realtime concrete metrics/config/publisher classes',
  );
});
