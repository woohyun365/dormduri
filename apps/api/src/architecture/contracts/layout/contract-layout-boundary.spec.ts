import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const apiRoot = process.cwd();
const apiSourceRoot = join(apiRoot, 'src');
const architectureLayoutRoot = join(apiSourceRoot, 'architecture/contracts/layout');

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

function sourceRelativePath(path: string) {
  return relative(apiSourceRoot, path).split(sep).join('/');
}

describe('shared contract layout spec boundary', () => {
  it('keeps shared package layout fitness specs under architecture/contracts/layout', () => {
    const layoutSpecs = walkTypeScriptFiles(apiSourceRoot)
      .filter((path) => path.endsWith('-layout.spec.ts'))
      .map(sourceRelativePath)
      .sort();

    expect(layoutSpecs).toEqual([
      'architecture/contracts/layout/auth-shared-contract-layout.spec.ts',
      'architecture/contracts/layout/chat-shared-contract-layout.spec.ts',
      'architecture/contracts/layout/notification-shared-contract-layout.spec.ts',
      'architecture/contracts/layout/retention-shared-contract-layout.spec.ts',
      'architecture/contracts/layout/season-shared-contract-layout.spec.ts',
      'architecture/contracts/layout/shared-contract-source-of-truth-layout.spec.ts',
      'architecture/contracts/layout/shared-neutral-contract-layout.spec.ts',
      'architecture/contracts/layout/user-shared-contract-layout.spec.ts',
    ]);
  });

  it('keeps behavior-facing shared contract specs in domain contracts directories', () => {
    for (const relativePath of [
      'auth/contracts/auth-shared-contract.spec.ts',
      'chat/contracts/chat-realtime-contract.spec.ts',
      'dormitories/contracts/dormitory-contract.spec.ts',
      'notifications/contracts/notification-contract.spec.ts',
      'season-participants/contracts/season-participation-contract.spec.ts',
      'seasons/contracts/season-contract.spec.ts',
    ]) {
      expect(existsSync(join(apiSourceRoot, relativePath))).toBe(true);
    }
  });

  it('does not leave domain-owned contract layout specs behind', () => {
    for (const relativePath of [
      'auth/contracts/auth-shared-contract-layout.spec.ts',
      'chat/contracts/chat-shared-contract-layout.spec.ts',
      'notifications/contracts/notification-shared-contract-layout.spec.ts',
    ]) {
      expect(existsSync(join(apiSourceRoot, relativePath))).toBe(false);
    }

    expect(existsSync(architectureLayoutRoot)).toBe(true);
  });
});
