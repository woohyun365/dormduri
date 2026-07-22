import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('MatchHistoryQueryService', () => {
  it('keeps retained/deleted counterpart presentation in the history query slice', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/matches/history/application/match-history-query.service.ts'),
      'utf8',
    );

    expect(source).toContain('listPastSeasonHistoryForUser');
    expect(source).toContain('getFinalCounterpartProfileForEntry');
    expect(source).toContain('DEIDENTIFIED_USER_DISPLAY_NAME');
    expect(source).toContain('readMatchHistoryCompatibilitySnapshot(entry)');
    expect(source).toContain('compatibilitySnapshot: true');
    expect(source).not.toContain('buildPublicProfileCompatibility');
    expect(source).not.toContain('conversationThreads');
  });

  it('과거 참여 여부는 현재 intent가 아니라 등록 완료 시점으로 판별한다', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/matches/history/application/match-history-query.service.ts'),
      'utf8',
    );

    expect(source).toContain('registeredAt: { not: null }');
    expect(source).not.toContain("participationIntent: 'REGISTERED'");
  });
});
