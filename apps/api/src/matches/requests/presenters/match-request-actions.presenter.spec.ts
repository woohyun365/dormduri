import { describe, expect, it } from 'vitest';
import type { CurrentSeasonContext } from '../../../seasons/ports/season-context.port.js';
import { makeMatchRequestParticipant } from '../../test-support/matches-service-spec.harness.js';
import type { MatchRequestRecord } from '../persistence/match-request.select.js';
import { resolveMatchRequestActions } from './match-request-actions.presenter.js';

const now = new Date('2026-02-10T03:00:00.000Z');
const season = {
  season: { id: 'season-1' },
  state: 'SEASON_MATCHING',
  operatedDormitories: [
    { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
  ],
} as CurrentSeasonContext;

function makeRequest(overrides: Partial<MatchRequestRecord> = {}): MatchRequestRecord {
  return {
    id: 'request-1',
    seasonId: 'season-1',
    requesterParticipantId: 'participant-2',
    receiverParticipantId: 'participant-1',
    status: 'PENDING',
    note: null,
    createdAt: now,
    expiresAt: new Date('2026-02-11T03:00:00.000Z'),
    terminalAt: null,
    acceptedAt: null,
    terminalReason: null,
    requesterParticipant: makeMatchRequestParticipant('user-2') as never,
    receiverParticipant: makeMatchRequestParticipant('user-1') as never,
    ...overrides,
  };
}

function resolve(request: MatchRequestRecord, overrides = {}) {
  return resolveMatchRequestActions({
    request,
    viewerParticipantId: 'participant-1',
    season,
    registrationSnapshotParticipantIds: new Set(['participant-1', 'participant-2']),
    activeParticipantIds: new Set(),
    now,
    ...overrides,
  });
}

describe('match request action presenter', () => {
  it('수신 요청은 transaction precondition이 완전할 때 수락과 거절을 각각 허용한다', () => {
    expect(resolve(makeRequest())).toEqual({
      accept: { allowed: true, reason: null },
      reject: { allowed: true, reason: null },
      cancel: { allowed: false, reason: null },
    });
  });

  it('registration snapshot이 stale이면 수락만 닫고 cleanup 거절은 유지한다', () => {
    expect(
      resolve(makeRequest(), {
        registrationSnapshotParticipantIds: new Set(['participant-1']),
      }),
    ).toEqual({
      accept: { allowed: false, reason: 'MATCH_PRECONDITION_FAILED' },
      reject: { allowed: true, reason: null },
      cancel: { allowed: false, reason: null },
    });
  });

  it('상대 또는 viewer에게 active relation이 생긴 stale 요청은 수락을 닫는다', () => {
    expect(
      resolve(makeRequest(), {
        activeParticipantIds: new Set(['participant-2']),
      }).accept,
    ).toEqual({ allowed: false, reason: 'MATCH_PRECONDITION_FAILED' });
  });

  it('보낸 pending 요청의 취소는 season action window와 무관한 cleanup capability다', () => {
    const request = makeRequest({
      requesterParticipantId: 'participant-1',
      receiverParticipantId: 'participant-2',
    });

    expect(resolve(request, { season: { ...season, state: 'SEASON_POST_MATCH' } })).toEqual({
      accept: { allowed: false, reason: null },
      reject: { allowed: false, reason: null },
      cancel: { allowed: true, reason: null },
    });
  });
});
