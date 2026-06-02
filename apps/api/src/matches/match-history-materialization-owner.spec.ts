import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('match history materialization owner', () => {
  it('match history persistence는 chat thread closure snapshot을 저장하지 않는다', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/matches/match-history-materialization-owner.ts'),
      'utf8',
    );

    expect(source).not.toContain('threadClosedReason');
    expect(source).not.toContain('threadClosedAt');
    expect(source).not.toContain('closedReason: true');
    expect(source).not.toContain('closedAt: true');
  });

  it('match history materialization은 chat thread conversation 여부를 읽지 않는다', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/matches/match-history-materialization-owner.ts'),
      'utf8',
    );

    expect(source).not.toContain('conversationThreads');
    expect(source).not.toContain('ConversationThread');
    expect(source).not.toContain('ConversationMessage');
    expect(source).not.toContain('hadConversation');
    expect(source).not.toContain('lastMessageAt');
  });
});
