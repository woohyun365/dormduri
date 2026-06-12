import { describe, expect, it } from 'vitest';
import {
  canPersistPreparedMatchRequest,
  canStartMatchRequestCreation,
  isMatchRequestCreationParticipantReady,
  type MatchRequestCreationParticipantPolicyInput,
} from './match-request-creation.policy.js';

function readyParticipant(
  overrides: Partial<MatchRequestCreationParticipantPolicyInput> = {},
): MatchRequestCreationParticipantPolicyInput {
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

describe('match request creation policy', () => {
  it('treats only registered visible complete participants as request-ready', () => {
    expect(isMatchRequestCreationParticipantReady(readyParticipant())).toBe(true);
    expect(
      isMatchRequestCreationParticipantReady(readyParticipant({ participantStatus: 'EXPIRED' })),
    ).toBe(false);
    expect(
      isMatchRequestCreationParticipantReady(readyParticipant({ hiddenByAdminAt: new Date() })),
    ).toBe(false);
    expect(
      isMatchRequestCreationParticipantReady(readyParticipant({ seasonProfileComplete: false })),
    ).toBe(false);
  });

  it('requires both viewer and target action policies to allow request creation', () => {
    expect(
      canStartMatchRequestCreation({ requesterCanRequestMatch: true, targetCanRequestMatch: true }),
    ).toBe(true);
    expect(
      canStartMatchRequestCreation({
        requesterCanRequestMatch: true,
        targetCanRequestMatch: false,
      }),
    ).toBe(false);
  });

  it('keeps transaction-time persistence preconditions together', () => {
    expect(
      canPersistPreparedMatchRequest({
        requesterReady: true,
        receiverReady: true,
        requesterDormitoryId: 'dasan',
        receiverDormitoryId: 'dasan',
        operationOperated: true,
        roomSelectionOpen: true,
        registrationSnapshotCount: 2,
      }),
    ).toBe(true);
    expect(
      canPersistPreparedMatchRequest({
        requesterReady: true,
        receiverReady: true,
        requesterDormitoryId: 'dasan',
        receiverDormitoryId: 'saerom',
        operationOperated: true,
        roomSelectionOpen: true,
        registrationSnapshotCount: 2,
      }),
    ).toBe(false);
  });
});
