import { describe, expect, it } from 'vitest';
import { makeMatchRequestParticipant } from '../test-support/matches-service-spec.harness.js';
import { toCurrentMatchActivity } from './current-match-activity.presenter.js';

const viewerParticipantId = 'participant-viewer';
const matchedAt = new Date('2026-08-04T03:00:00.000Z');

describe('toCurrentMatchActivity', () => {
  it('매칭 완료를 자동 종료 요청보다 먼저 두고 causal group을 viewer 기준으로 분류한다', () => {
    const activity = toCurrentMatchActivity({
      viewerParticipantId,
      requests: [
        request({
          id: 'auto-closed',
          requesterParticipantId: viewerParticipantId,
          receiverParticipantId: 'participant-other',
          status: 'CANCELLED_BY_SYSTEM',
          terminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
          terminalAt: matchedAt,
          systemCancellationActiveMatchId: 'active-1',
          systemCancellationActiveMatch: {
            participantAId: viewerParticipantId,
            participantBId: 'participant-partner',
          },
        }),
        request({
          id: 'accepted',
          requesterParticipantId: viewerParticipantId,
          receiverParticipantId: 'participant-partner',
          status: 'ACCEPTED',
          terminalReason: 'ACCEPTED',
          terminalAt: matchedAt,
          acceptedAt: matchedAt,
        }),
      ],
      activeMatches: [
        {
          id: 'active-1',
          participantAId: viewerParticipantId,
          participantBId: 'participant-partner',
          status: 'ACTIVE',
          startedAt: matchedAt,
          endedAt: null,
          endReason: null,
          createdFromRequestId: 'accepted',
          createdFromRequest: { requesterParticipantId: viewerParticipantId },
          participantA: participant('viewer'),
          participantB: participant('partner'),
        } as never,
      ],
    });

    expect(activity.map((entry) => entry.id)).toEqual(['match:active-1', 'request:auto-closed']);
    expect(activity[1]).toMatchObject({
      systemCancellationCause: 'VIEWER_MATCHED',
      systemCancellationGroupId: 'active-1',
    });
  });

  it('현재 시즌에 종료된 active relation을 매칭 후 해제로 투영한다', () => {
    const endedAt = new Date('2026-08-06T03:00:00.000Z');
    const activity = toCurrentMatchActivity({
      viewerParticipantId,
      requests: [],
      activeMatches: [
        {
          id: 'active-ended',
          participantAId: viewerParticipantId,
          participantBId: 'participant-partner',
          status: 'UNMATCHED',
          startedAt: matchedAt,
          endedAt,
          endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
          createdFromRequestId: 'accepted',
          createdFromRequest: { requesterParticipantId: 'participant-partner' },
          participantA: participant('viewer'),
          participantB: participant('partner'),
        } as never,
      ],
    });

    expect(activity[0]).toMatchObject({
      result: 'UNMATCHED_AFTER_SUCCESS',
      direction: 'RECEIVED',
      occurredAt: endedAt.toISOString(),
      activeMatchEndReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
    });
  });
});

function request(overrides: Record<string, unknown>) {
  return {
    id: 'request-1',
    seasonId: 'season-1',
    requesterParticipantId: viewerParticipantId,
    receiverParticipantId: 'participant-other',
    status: 'REJECTED',
    note: null,
    createdAt: new Date('2026-08-01T03:00:00.000Z'),
    expiresAt: new Date('2026-08-05T03:00:00.000Z'),
    terminalAt: new Date('2026-08-02T03:00:00.000Z'),
    acceptedAt: null,
    terminalReason: 'REJECTED_BY_RECEIVER',
    systemCancellationActiveMatchId: null,
    systemCancellationActiveMatch: null,
    requesterParticipant: makeMatchRequestParticipant('user-viewer'),
    receiverParticipant: makeMatchRequestParticipant('user-other'),
    ...overrides,
  } as never;
}

function participant(nickname: string) {
  return {
    user: { deletedAt: null },
    profile: { nicknameSnapshot: nickname },
  };
}
