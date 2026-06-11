import { resolveRetainedIdentityDecision } from './retained-identity-decision.policy.js';

describe('retained-identity-decision.policy', () => {
  it('legal hold가 report/enforcement보다 우선한다', () => {
    const deletedAt = new Date('2026-05-12T00:00:00.000Z');

    expect(
      resolveRetainedIdentityDecision({
        deletedAt,
        reportOpen: true,
        enforcementRecord: true,
        legalHoldReason: 'LAW_ENFORCEMENT_REQUEST',
      }),
    ).toMatchObject({
      retentionCaseReason: 'LEGAL_HOLD',
      legalHoldReason: 'LAW_ENFORCEMENT_REQUEST',
    });
  });

  it.each([
    'LAW_ENFORCEMENT_REQUEST',
    'INTERNAL_DISPUTE_REVIEW',
    'SAFETY_INCIDENT',
    'ADMIN_LEGAL_REVIEW',
  ] as const)('%s legal hold는 수동 보존 만료일과 함께 LEGAL_HOLD로 분류한다', (reason) => {
    const deletedAt = new Date('2026-05-12T00:00:00.000Z');
    const manualRetentionUntil = new Date('2029-05-12T00:00:00.000Z');

    expect(
      resolveRetainedIdentityDecision({
        deletedAt,
        legalHoldReason: reason,
        manualRetentionUntil,
      }),
    ).toEqual({
      retentionCaseReason: 'LEGAL_HOLD',
      legalHoldReason: reason,
      holdUntil: manualRetentionUntil,
    });
  });

  it('report/enforcement/dispute가 일반 account deletion보다 우선한다', () => {
    const deletedAt = new Date('2026-05-12T00:00:00.000Z');

    expect(resolveRetainedIdentityDecision({ deletedAt, disputeOpen: true })).toMatchObject({
      retentionCaseReason: 'DISPUTE_RESPONSE',
    });
    expect(resolveRetainedIdentityDecision({ deletedAt, reportOpen: true })).toMatchObject({
      retentionCaseReason: 'REPORT_REVIEW',
    });
    expect(resolveRetainedIdentityDecision({ deletedAt, enforcementRecord: true })).toMatchObject({
      retentionCaseReason: 'ENFORCEMENT_RECORD',
    });
    expect(resolveRetainedIdentityDecision({ deletedAt })).toMatchObject({
      retentionCaseReason: 'ACCOUNT_DELETION',
      holdUntil: new Date('2026-05-17T00:00:00.000Z'),
    });
  });
});
