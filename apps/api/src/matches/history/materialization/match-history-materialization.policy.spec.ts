import { describe, expect, it } from 'vitest';
import type { SeasonHistorySource } from './ended-season-history.loader.js';
import { resolveHistorySystemCancellation } from './match-history-materialization.policy.js';

function makeSystemCancelledRequest(): SeasonHistorySource['matchRequests'][number] {
  return {
    id: 'request-1',
    requesterParticipantId: 'viewer',
    receiverParticipantId: 'counterpart',
    status: 'CANCELLED_BY_SYSTEM',
    terminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
    terminalAt: new Date('2026-04-04T02:00:00.000Z'),
    createdAt: new Date('2026-04-01T02:00:00.000Z'),
    systemCancellationActiveMatchId: 'active-match-1',
    systemCancellationActiveMatch: {
      participantAId: 'viewer',
      participantBId: 'matched-partner',
    },
  };
}

describe('match history system cancellation policy', () => {
  it('causal active match에 viewer가 포함되면 viewer match 원인으로 분류한다', () => {
    expect(
      resolveHistorySystemCancellation({
        request: makeSystemCancelledRequest(),
        viewerParticipantId: 'viewer',
        counterpartParticipantId: 'counterpart',
      }),
    ).toEqual({
      systemCancellationCause: 'VIEWER_MATCHED',
      systemCancellationGroupId: 'active-match-1',
    });
  });

  it('causal active match에 counterpart만 포함되면 counterpart match 원인으로 분류한다', () => {
    const request = makeSystemCancelledRequest();
    request.systemCancellationActiveMatch = {
      participantAId: 'counterpart',
      participantBId: 'other-participant',
    };

    expect(
      resolveHistorySystemCancellation({
        request,
        viewerParticipantId: 'viewer',
        counterpartParticipantId: 'counterpart',
      }),
    ).toEqual({
      systemCancellationCause: 'COUNTERPART_MATCHED',
      systemCancellationGroupId: 'active-match-1',
    });
  });

  it('causal relation이 없는 legacy row는 원인을 추정하지 않는다', () => {
    const request = makeSystemCancelledRequest();
    request.systemCancellationActiveMatchId = null;
    request.systemCancellationActiveMatch = null;

    expect(
      resolveHistorySystemCancellation({
        request,
        viewerParticipantId: 'viewer',
        counterpartParticipantId: 'counterpart',
      }),
    ).toEqual({
      systemCancellationCause: null,
      systemCancellationGroupId: null,
    });
  });
});
