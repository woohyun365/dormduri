import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

type PackageJson = {
  exports: Record<string, { types: string; default: string } | undefined>;
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
    ]) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(true);
    }
  });

  it('legacy root chat source/export 없이 canonical chat package exports만 제공한다', () => {
    for (const relativePath of [
      'chat-contract-enums.ts',
      'chat-contract-thread.ts',
      'chat-contract-request.ts',
      'chat-contract-response.ts',
      'chat-contract.ts',
      'chat-realtime-events.ts',
      'chat-realtime-contract.ts',
      'compat/chat-contract.ts',
    ]) {
      expect(existsSync(join(sharedSrc, relativePath))).toBe(false);
    }

    for (const publicPath of [
      './chat-contract',
      './chat-realtime-contract',
      './chat-realtime-events',
    ]) {
      expect(sharedPackageJson.exports[publicPath]).toBeUndefined();
    }
  });

  it('canonical chat package exports는 aggregate와 realtime axis를 제공한다', () => {
    expect(sharedPackageJson.exports['./chat']).toEqual({
      types: './dist/chat/index.d.ts',
      default: './dist/chat/index.js',
    });
    expect(sharedPackageJson.exports['./chat/realtime-contract']).toEqual({
      types: './dist/chat/realtime-contract.d.ts',
      default: './dist/chat/realtime-contract.js',
    });
    expect(sharedPackageJson.exports['./chat/realtime-events']).toEqual({
      types: './dist/chat/realtime-events.d.ts',
      default: './dist/chat/realtime-events.js',
    });
  });
});
