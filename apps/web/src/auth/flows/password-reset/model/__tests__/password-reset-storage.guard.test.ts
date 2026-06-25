import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PASSWORD_RESET_STORAGE_WRITE_PATTERNS } from '../password-reset-storage.guard';

const passwordResetSourceDir = join(process.cwd(), 'src/auth/flows/password-reset');

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (entry === '__tests__') return [];
      return collectSourceFiles(path);
    }

    if (!/\.(ts|tsx)$/.test(entry)) return [];
    return [path];
  });
}

describe('password-reset storage guard', () => {
  it('verification code/password flow가 browser storage나 URL history에 민감값을 쓰지 않는다', () => {
    const offenders = collectSourceFiles(passwordResetSourceDir).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return PASSWORD_RESET_STORAGE_WRITE_PATTERNS.filter((pattern) => pattern.test(source)).map(
        (pattern) => `${relative(passwordResetSourceDir, path)}:${pattern.source}`,
      );
    });

    expect(offenders).toEqual([]);
  });
});
