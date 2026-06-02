import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  matchHistoryEntrySchema,
  matchHistorySeasonSummarySchema,
} from '@repo/shared/match-contract';
import { toMatchHistoryResponse, type MatchHistoryEntryRow } from './match-history-read-model.js';

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

function makeHistoryEntryRow(overrides: Partial<MatchHistoryEntryRow> = {}): MatchHistoryEntryRow {
  return {
    id: 'history-entry-1',
    viewerParticipantId: 'viewer-participant-1',
    counterpartParticipantId: 'counterpart-participant-1',
    counterpartNicknameSnapshot: '상대방',
    entryType: 'MATCH',
    entryResult: 'MATCHED_SUCCESS',
    viewerRequested: true,
    matchedAt: new Date('2026-02-10T03:00:00.000Z'),
    unmatchedAt: null,
    finalizedAt: new Date('2026-02-28T03:00:00.000Z'),
    requestTerminalReason: null,
    activeMatchEndReason: null,
    ...overrides,
  };
}

describe('match history read model', () => {
  it('match history contract는 chat implementation을 import하지 않는다', () => {
    const source = readFileSync(
      join(findRepoRoot(), 'packages/shared/src/match-contract-history.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/['"].*chat/);
    expect(source).not.toContain('conversationThreadClosedReasonSchema');
  });

  it('public history entry는 chat-derived fields를 노출하지 않는다', () => {
    const response = toMatchHistoryResponse({
      seasons: [
        {
          participantId: 'viewer-participant-1',
          seasonId: 'season-1',
          seasonName: '2026-1',
          viewerDormitoryIdSnapshot: 'dormitory-1',
        },
      ],
      entries: [makeHistoryEntryRow()],
    });

    const entry = response.items[0]?.history[0];

    expect(entry).toMatchObject({
      id: 'history-entry-1',
      result: 'MATCHED_SUCCESS',
    });
    expect(response.items[0]).not.toHaveProperty('conversationCount');
    expect(entry).not.toHaveProperty('hadConversation');
    expect(entry).not.toHaveProperty('threadClosedReason');
    expect(entry).not.toHaveProperty('threadClosedAt');
  });

  it('match history contract는 chat closed reason 필드를 거부한다', () => {
    expect(
      matchHistoryEntrySchema.safeParse({
        id: 'history-entry-1',
        counterpartParticipantId: 'counterpart-participant-1',
        counterpartNickname: '상대방',
        stage: 'MATCH',
        result: 'MATCHED_SUCCESS',
        viewerRequested: true,
        matchedAt: '2026-02-10T03:00:00.000Z',
        unmatchedAt: null,
        finalizedAt: '2026-02-28T03:00:00.000Z',
        requestTerminalReason: null,
        activeMatchEndReason: null,
        threadClosedReason: 'SEASON_ENDED',
        threadClosedAt: '2026-02-28T03:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('match history contract는 conversation field를 거부한다', () => {
    expect(
      matchHistoryEntrySchema.safeParse({
        id: 'history-entry-1',
        counterpartParticipantId: 'counterpart-participant-1',
        counterpartNickname: '상대방',
        stage: 'MATCH',
        result: 'MATCHED_SUCCESS',
        viewerRequested: true,
        hadConversation: true,
        matchedAt: '2026-02-10T03:00:00.000Z',
        unmatchedAt: null,
        finalizedAt: '2026-02-28T03:00:00.000Z',
        requestTerminalReason: null,
        activeMatchEndReason: null,
      }).success,
    ).toBe(false);

    expect(
      matchHistorySeasonSummarySchema.safeParse({
        seasonId: 'season-1',
        seasonName: '2026-1',
        viewerParticipantId: 'viewer-participant-1',
        viewerDormitoryIdSnapshot: null,
        finalResult: 'MATCHED_SUCCESS',
        sentRequestCount: 0,
        receivedRequestCount: 0,
        conversationCount: 1,
        history: [],
      }).success,
    ).toBe(false);
  });
});
