import { describe, expect, it } from 'vitest';
import { canActorResolveTerminalMatchRequest } from './match-request-terminal.policy.js';

describe('match request terminal policy', () => {
  it('allows only receiver to reject and requester to cancel', () => {
    expect(
      canActorResolveTerminalMatchRequest({
        status: 'REJECTED',
        requesterParticipantId: 'requester',
        receiverParticipantId: 'receiver',
        actingParticipantId: 'receiver',
      }),
    ).toBe(true);
    expect(
      canActorResolveTerminalMatchRequest({
        status: 'REJECTED',
        requesterParticipantId: 'requester',
        receiverParticipantId: 'receiver',
        actingParticipantId: 'requester',
      }),
    ).toBe(false);
    expect(
      canActorResolveTerminalMatchRequest({
        status: 'CANCELLED_BY_REQUESTER',
        requesterParticipantId: 'requester',
        receiverParticipantId: 'receiver',
        actingParticipantId: 'requester',
      }),
    ).toBe(true);
  });
});
