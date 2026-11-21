import { describe, expect, it } from 'vitest';
import { approvalContentDigest, decideApproval } from './approval-policy.js';

describe('approval decision policy (OA-R9)', () => {
  it('allows a decision by an account other than the requester', () => {
    expect(
      decideApproval({
        decision: 'approve',
        requesterId: 'a',
        deciderId: 'b',
        activeApproverIds: ['a', 'b'],
        reason: undefined,
      }),
    ).toEqual({ allowed: true, selfApproved: false });
  });

  it('allows a self approval only for the sole approver, with a reason, and marks it', () => {
    expect(
      decideApproval({
        decision: 'approve',
        requesterId: 'a',
        deciderId: 'a',
        activeApproverIds: ['a'],
        reason: 'first operator',
      }),
    ).toEqual({ allowed: true, selfApproved: true });
    expect(
      decideApproval({
        decision: 'approve',
        requesterId: 'a',
        deciderId: 'a',
        activeApproverIds: ['a'],
        reason: undefined,
      }),
    ).toEqual({ allowed: false, reason: 'reason_required' });
  });

  it('refuses a self approval once a second approver exists', () => {
    expect(
      decideApproval({
        decision: 'approve',
        requesterId: 'a',
        deciderId: 'a',
        activeApproverIds: ['a', 'b'],
        reason: 'first operator',
      }),
    ).toEqual({ allowed: false, reason: 'separation_of_duties' });
  });

  it('never lets the requester reject their own request', () => {
    expect(
      decideApproval({
        decision: 'reject',
        requesterId: 'a',
        deciderId: 'a',
        activeApproverIds: ['a'],
        reason: 'changed my mind',
      }),
    ).toEqual({ allowed: false, reason: 'separation_of_duties' });
  });

  it('binds the digest to the kind, the target and the role', () => {
    const base = { kind: 'ROLE_GRANT', targetAccountId: 'x', targetRole: 'AUDITOR' } as const;
    expect(approvalContentDigest(base)).toMatch(/^[a-f0-9]{64}$/u);
    expect(approvalContentDigest(base)).toBe(approvalContentDigest({ ...base }));
    expect(approvalContentDigest({ ...base, kind: 'ROLE_REVOKE' })).not.toBe(
      approvalContentDigest(base),
    );
    expect(approvalContentDigest({ ...base, targetRole: 'OWNER' })).not.toBe(
      approvalContentDigest(base),
    );
    expect(approvalContentDigest({ ...base, targetAccountId: 'y' })).not.toBe(
      approvalContentDigest(base),
    );
  });
});
