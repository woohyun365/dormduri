import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chatStoryScenarios } from '../__stories__/chat-story-scenarios';

describe('ChatTab seasonal story scenarios', () => {
  it('four-season 분류는 chat owner capability를 fixture로 소비한다', () => {
    expect(chatStoryScenarios.offSeasonArchived.seasonContext.state).toBe('OFF_SEASON');
    expect(chatStoryScenarios.seasonOpenDirect.seasonContext.state).toBe('SEASON_OPEN');
    expect(chatStoryScenarios.seasonMatchingMatched.seasonContext.state).toBe('SEASON_MATCHING');
    expect(chatStoryScenarios.postMatchMatchedOpen.seasonContext.state).toBe('SEASON_POST_MATCH');

    const cutoff = chatStoryScenarios.seasonMatchingDirectCutoff.list.items[0]!;
    const postMatch = chatStoryScenarios.postMatchMatchedOpen.list.items[0]!;
    expect(cutoff.canSendMessage).toBe(false);
    expect(cutoff.sendMessageUnavailableReason).toBe('THREAD_READ_ONLY');
    expect(postMatch.threadKind).toBe('MATCHED');
    expect(postMatch.canSendMessage).toBe(true);
  });

  it('story fixture는 chat BFF/social-safety owner route만 가로챈다', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/main/tabs/chat/__stories__/chat-story-api-fixtures.ts'),
      'utf8',
    );
    expect(source).toContain("'/api/chat/threads'");
    expect(source).toContain("'/api/reports'");
    expect(source).not.toContain('/api/matches/overview');
    expect(source).not.toContain('/api/profiles/');
  });
});
