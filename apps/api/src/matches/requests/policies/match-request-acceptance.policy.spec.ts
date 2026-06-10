import {
  isRegistrationCompleteMatchRequestParticipant,
  isWithdrawnMatchRequestParticipant,
  resolveMatchRequestAcceptancePrecondition,
  type MatchRequestAcceptanceParticipantPolicyInput,
} from './match-request-acceptance.policy.js';

function participant(
  overrides: Partial<MatchRequestAcceptanceParticipantPolicyInput> = {},
): MatchRequestAcceptanceParticipantPolicyInput {
  return {
    participationIntent: 'REGISTERED',
    registeredAt: new Date('2026-02-01T00:00:00.000Z'),
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
    participantStatus: 'ACTIVE',
    declinedAt: null,
    withdrawnAt: null,
    hiddenByAdminAt: null,
    deactivatedAt: null,
    userDeletedAt: null,
    seasonProfileComplete: true,
    ...overrides,
  };
}

describe('match request acceptance policy', () => {
  it('withdrawn/declined participant는 withdrawn terminal precondition으로 분류한다', () => {
    expect(isWithdrawnMatchRequestParticipant(participant())).toBe(false);
    expect(
      isWithdrawnMatchRequestParticipant(participant({ participationIntent: 'DECLINED' })),
    ).toBe(true);
    expect(isWithdrawnMatchRequestParticipant(participant({ withdrawnAt: new Date() }))).toBe(true);

    expect(
      resolveMatchRequestAcceptancePrecondition({
        requester: participant({ withdrawnAt: new Date() }),
        receiver: participant(),
        sameDormitory: true,
        seasonMatching: true,
        roomSelectionOpen: true,
        registrationSnapshotCount: 2,
      }),
    ).toEqual({ kind: 'TERMINAL', terminalReason: 'WITHDRAWN_PARTICIPANT' });
  });

  it('registered + assigned + visible + profile complete participant만 registration complete로 본다', () => {
    expect(isRegistrationCompleteMatchRequestParticipant(participant())).toBe(true);
    expect(
      isRegistrationCompleteMatchRequestParticipant(participant({ participantStatus: 'EXPIRED' })),
    ).toBe(false);
    expect(
      isRegistrationCompleteMatchRequestParticipant(participant({ hiddenByAdminAt: new Date() })),
    ).toBe(false);
    expect(
      isRegistrationCompleteMatchRequestParticipant(participant({ seasonProfileComplete: false })),
    ).toBe(false);
  });

  it('registration/profile/snapshot/season cutoff 실패는 match precondition terminal로 분류한다', () => {
    expect(
      resolveMatchRequestAcceptancePrecondition({
        requester: participant(),
        receiver: participant(),
        sameDormitory: true,
        seasonMatching: true,
        roomSelectionOpen: true,
        registrationSnapshotCount: 2,
      }),
    ).toEqual({ kind: 'ACCEPTABLE' });

    expect(
      resolveMatchRequestAcceptancePrecondition({
        requester: participant(),
        receiver: participant(),
        sameDormitory: false,
        seasonMatching: true,
        roomSelectionOpen: true,
        registrationSnapshotCount: 2,
      }),
    ).toEqual({ kind: 'TERMINAL', terminalReason: 'MATCH_PRECONDITION_FAILED' });

    expect(
      resolveMatchRequestAcceptancePrecondition({
        requester: participant(),
        receiver: participant(),
        sameDormitory: true,
        seasonMatching: true,
        roomSelectionOpen: false,
        registrationSnapshotCount: 2,
      }),
    ).toEqual({ kind: 'TERMINAL', terminalReason: 'MATCH_PRECONDITION_FAILED' });
  });
});
