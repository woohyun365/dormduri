import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('match history retention archive', () => {
  it('viewer/counterpart 중 한 명이라도 redaction되면 공개 compatibility를 함께 제거한다', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/matches/history/retention/match-history-archive.handler.ts'),
      'utf8',
    );

    expect(source).toContain('if (roles.length > 0)');
    expect(source).toContain('compatibilitySnapshot: Prisma.DbNull');
    expect(source).toContain('compatibilitySchemaVersion: null');
  });
});
