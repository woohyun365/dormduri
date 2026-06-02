import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type PackageJson = {
  exports: Record<string, { types: string; default: string }>;
};

function findRepoRoot() {
  let current = process.cwd();

  while (!existsSync(join(current, 'packages/shared/src'))) {
    const parent = dirname(current);
    if (parent === current) {
      throw new Error('repo root with packages/shared/src not found');
    }
    current = parent;
  }

  return current;
}

const repoRoot = findRepoRoot();
const sharedSrc = join(repoRoot, 'packages/shared/src');
const sharedPackageJson = JSON.parse(
  readFileSync(join(repoRoot, 'packages/shared/package.json'), 'utf8'),
) as PackageJson;

describe('shared chat contract layout', () => {
  it('chat contract implementation은 chat 하위 디렉토리에 둔다', () => {
    for (const relativePath of [
      'chat/enums.ts',
      'chat/thread.ts',
      'chat/request.ts',
      'chat/response.ts',
      'chat/realtime-events.ts',
      'chat/realtime-contract.ts',
      'chat/index.ts',
      'compat/chat-contract.ts',
    ]) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(true);
    }
  });

  it('chat-contract compat entry는 legacy aggregate public surface만 보존한다', () => {
    expect(readFileSync(join(sharedSrc, 'compat/chat-contract.ts'), 'utf8')).toBe(
      "export * from '../chat/index.js';\nexport * from '../notifications/index.js';\n",
    );
  });

  it('legacy root chat source files 없이 package exports가 기존 public path를 nested/compat dist로 매핑한다', () => {
    for (const relativePath of [
      'chat-contract-enums.ts',
      'chat-contract-thread.ts',
      'chat-contract-request.ts',
      'chat-contract-response.ts',
      'chat-contract.ts',
      'chat-realtime-events.ts',
      'chat-realtime-contract.ts',
    ]) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(false);
    }

    expect(sharedPackageJson.exports['./chat-contract']).toEqual({
      types: './dist/compat/chat-contract.d.ts',
      default: './dist/compat/chat-contract.js',
    });
    expect(sharedPackageJson.exports['./chat-realtime-contract']).toEqual({
      types: './dist/chat/realtime-contract.d.ts',
      default: './dist/chat/realtime-contract.js',
    });
    expect(sharedPackageJson.exports['./chat-realtime-events']).toEqual({
      types: './dist/chat/realtime-events.d.ts',
      default: './dist/chat/realtime-events.js',
    });
  });
});
