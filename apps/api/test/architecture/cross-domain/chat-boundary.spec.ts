import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

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

const threadMutationMethods = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);
type ChatReference = { model: 'conversationThread' | 'conversationMessage'; method?: string };

function chatPersistenceViolations(source: string): string[] {
  const file = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.Latest, true);
  // Bind local symbols without loading the project/dependencies. This prevents a
  // shadowed name being mistaken for an outer delegate alias, not a Prisma type proof.
  const options: ts.CompilerOptions = { noLib: true, noResolve: true, types: [] };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name) => (name === file.fileName ? file : undefined);
  const checker = ts.createProgram([file.fileName], options, host).getTypeChecker();
  const violations = new Set<string>();

  function propertyName(node: ts.Node | undefined): string | undefined {
    if (node && (ts.isIdentifier(node) || ts.isStringLiteralLike(node))) return node.text;
    if (node && ts.isComputedPropertyName(node) && ts.isStringLiteralLike(node.expression))
      return node.expression.text;
    return undefined;
  }
  function member(
    receiver: ChatReference | undefined,
    key: string | undefined,
  ): ChatReference | undefined {
    if (key === 'conversationThread' || key === 'conversationMessage') return { model: key };
    if (receiver && !receiver.method && key) return { model: receiver.model, method: key };
    return undefined;
  }
  function initializer(node: ts.VariableDeclaration): ts.Expression | undefined {
    return ts.isVariableDeclarationList(node.parent) && node.parent.flags & ts.NodeFlags.Const
      ? node.initializer
      : undefined;
  }
  function binding(node: ts.BindingElement, seen: Set<ts.Symbol>): ChatReference | undefined {
    if (!ts.isObjectBindingPattern(node.parent) || node.dotDotDotToken) return undefined;
    const owner = node.parent.parent;
    let receiver: ChatReference | undefined;
    if (ts.isVariableDeclaration(owner)) {
      const value = initializer(owner);
      if (!value) return undefined;
      receiver = reference(value, seen);
    } else if (ts.isBindingElement(owner)) {
      receiver = binding(owner, seen);
    } else return undefined;
    return member(receiver, propertyName(node.propertyName ?? node.name));
  }
  // Finite syntax rule: explicit model names/members, const aliases and object bindings.
  // Assignment/dataflow, computed runtime keys and interprocedural aliases are not inferred.
  function reference(node: ts.Expression, seen = new Set<ts.Symbol>()): ChatReference | undefined {
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression(node)
    )
      return reference(node.expression, seen);
    if (ts.isPropertyAccessExpression(node))
      return member(reference(node.expression, seen), node.name.text);
    if (ts.isElementAccessExpression(node))
      return member(
        reference(node.expression, seen),
        ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : undefined,
      );
    if (!ts.isIdentifier(node)) return undefined;
    // Keep the old direct-receiver restriction, including model-named parameters.
    // Alias binding extends this name-based rule; it must not narrow it to const declarations.
    if (node.text === 'conversationThread' || node.text === 'conversationMessage')
      return { model: node.text };
    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol || seen.has(symbol)) return undefined;
    seen.add(symbol);
    for (const declaration of symbol.declarations ?? []) {
      if (ts.isVariableDeclaration(declaration)) {
        const value = initializer(declaration);
        if (value) return reference(value, seen);
      }
      if (ts.isBindingElement(declaration)) return binding(declaration, seen);
    }
    return undefined;
  }
  function visit(node: ts.Node) {
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node) ||
      ts.isIdentifier(node)
    ) {
      const resolved = reference(node);
      if (
        resolved?.method &&
        (resolved.model === 'conversationMessage' || threadMutationMethods.has(resolved.method))
      )
        violations.add(`${resolved.model}.${resolved.method}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...violations].sort();
}

describe('cross-domain chat architecture boundary', () => {
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

  it('keeps season-participants off direct thread mutations and all message persistence access', () => {
    expect(
      productionTypeScriptFiles(join(apiSourceRoot, 'season-participants'))
        .filter((path) => chatPersistenceViolations(readSource(path)).length > 0)
        .map(relativeSourcePath)
        .sort(),
    ).toEqual([]);
  });

  it.each([
    'create',
    'createMany',
    'createManyAndReturn',
    'update',
    'updateMany',
    'updateManyAndReturn',
    'upsert',
    'delete',
    'deleteMany',
  ])('rejects the critical thread mutation %s', (method) => {
    expect(chatPersistenceViolations(`tx.conversationThread.${method}({});`)).not.toEqual([]);
  });

  it.each([
    `const db = tx; db.conversationThread.update({});`,
    `const threads = tx.conversationThread; threads.update({});`,
    `const threads = tx.conversationThread; const alias = threads; alias.deleteMany({});`,
    `const { conversationThread: threads } = tx; threads.upsert({});`,
    `const { conversationThread: { deleteMany: remove } } = tx; remove({});`,
    `const { conversationThread } = tx; conversationThread.delete({});`,
    `const { deleteMany: remove } = tx.conversationThread; remove({});`,
    `const threads = tx.conversationThread; threads['upsert']({});`,
    `tx['conversationThread']['deleteMany']({});`,
    `(tx.conversationThread).delete({});`,
    `(tx.conversationThread as Delegate).updateMany({});`,
    `tx.conversationThread?.deleteMany({});`,
    `const messages = tx.conversationMessage; messages.findMany({});`,
    `const { conversationMessage: messages } = tx; messages.deleteMany({});`,
    `const { conversationMessage: { findMany: read } } = tx; read({});`,
  ])('rejects aliased or literal-indexed chat persistence: %s', (source) => {
    expect(chatPersistenceViolations(source)).not.toEqual([]);
  });

  it.each([
    `await tx.conversationThread.findMany({});`,
    `const threads = tx.conversationThread; threads.count({});`,
    `await lifecycle.handleActiveMatchCreated(tx, input, now);`,
    `await deps.chatThreadWithdrawal.markOpenDirectThreadsReadOnlyForWithdrawnParticipant(tx, input);`,
    `await deps.matchParticipantWithdrawal.cancelPendingRequestsForWithdrawnParticipant(tx, input);`,
    `repository.update({});`,
    `const threads = tx.conversationThread; function unrelated(threads) { threads.update({}); }`,
    `const threads = tx.conversationThread; { const threads = repository; threads.update({}); }`,
    `const note = 'tx.conversationThread.update({})'; // tx.conversationMessage.findMany({})`,
  ])('allows owner-public collaboration, thread reads and unrelated code: %s', (source) => {
    expect(chatPersistenceViolations(source)).toEqual([]);
  });

  it('keeps direct message persistence blocked even for reads', () => {
    expect(chatPersistenceViolations('tx.conversationMessage.findMany({});')).not.toEqual([]);
  });

  it.each([
    `function read(conversationMessage) { return conversationMessage.findMany({}); }`,
    `function mutate(conversationThread) { return conversationThread.update({}); }`,
    `function read({ conversationMessage }: Prisma.TransactionClient) { return conversationMessage.findMany({}); }`,
    `function mutate({ conversationThread }: Prisma.TransactionClient) { return conversationThread.deleteMany({}); }`,
  ])('preserves direct model-named receiver restrictions: %s', (source) => {
    expect(chatPersistenceViolations(source)).not.toEqual([]);
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

  it('keeps the extracted send permission helper pure', () => {
    const source = readSource(
      join(apiSourceRoot, 'chat/policies/chat-thread-permission.policy.ts'),
    );

    expect(source).not.toMatch(
      /from\s+['"].*@nestjs|PrismaService|generated\/prisma|conversationThread|conversationMessage/,
    );
  });
});
