import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('match history score snapshot builder', () => {
  it('keeps chat-derived state out of score/history snapshots', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src/matches/history/materialization/match-history-score-snapshot.builder.ts',
      ),
      'utf8',
    );

    expect(source).toContain('buildDirectionalMatchScoreProjection');
    expect(source).not.toContain('conversationThreads');
    expect(source).not.toContain('ConversationThread');
    expect(source).not.toContain('ConversationMessage');
    expect(source).not.toContain('hadConversation');
    expect(source).not.toContain('lastMessageAt');
  });
});
