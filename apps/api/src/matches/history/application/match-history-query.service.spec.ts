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
    expect(source).not.toContain('conversationThreads');
  });
});
