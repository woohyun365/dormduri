import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('match history row builder', () => {
  const sourcePath = join(
    process.cwd(),
    'src/matches/history/materialization/match-history-row.builder.ts',
  );

  it('match history persistence는 chat thread closure snapshot을 저장하지 않는다', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).not.toContain('threadClosedReason');
    expect(source).not.toContain('threadClosedAt');
    expect(source).not.toContain('closedReason: true');
    expect(source).not.toContain('closedAt: true');
  });

  it('request/match rows are built from match-owned participant/request/active-match source only', () => {
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).toContain('buildRequestHistoryRow');
    expect(source).toContain('buildMatchHistoryRow');
    expect(source).not.toContain('conversationThreads');
    expect(source).not.toContain('ConversationThread');
    expect(source).not.toContain('ConversationMessage');
    expect(source).not.toContain('hadConversation');
    expect(source).not.toContain('lastMessageAt');
  });
});
