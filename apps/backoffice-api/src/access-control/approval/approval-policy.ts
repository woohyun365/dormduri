import { createHash } from 'node:crypto';
import type { AdminRole } from '@repo/database/enums';
import type { AccessRequestKind } from '@repo/shared/backoffice';
import { DAY_MS } from '../../platform/time/clock.js';

/** A request waits seven days for a decision, then expires (OA-R9). */
export const APPROVAL_REQUEST_TTL_MS = 7 * DAY_MS;

/**
 * Digest of what the request changes. The decider sends the digest they saw, and the decision is a
 * conditional UPDATE on that digest and the pending status, so one request is decided once.
 */
export function approvalContentDigest(content: {
  kind: AccessRequestKind;
  targetAccountId: string;
  targetRole: AdminRole;
}): string {
  const canonical = JSON.stringify([content.kind, content.targetAccountId, content.targetRole]);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export type DecisionOutcome =
  | { readonly allowed: true; readonly selfApproved: boolean }
  | { readonly allowed: false; readonly reason: 'separation_of_duties' | 'reason_required' };

/**
 * Separation of duties (operator-access.md OA-R9): the decider differs from the requester.
 * The one exception: when the requester is the only active account allowed to decide this kind,
 * they may approve their own request with a reason (the route already requires a passkey
 * re-authentication). The approvers are counted at decision time, so the exception ends as soon as
 * a second approver exists. A requester never rejects their own request; they cancel it.
 */
export function decideApproval(input: {
  decision: 'approve' | 'reject';
  requesterId: string;
  deciderId: string;
  activeApproverIds: readonly string[];
  reason: string | undefined;
}): DecisionOutcome {
  if (input.requesterId !== input.deciderId) {
    return { allowed: true, selfApproved: false };
  }
  if (input.decision === 'reject') {
    return { allowed: false, reason: 'separation_of_duties' };
  }
  const approvers = new Set(input.activeApproverIds);
  const soleApprover = approvers.size === 1 && approvers.has(input.deciderId);
  if (!soleApprover) {
    return { allowed: false, reason: 'separation_of_duties' };
  }
  if (!input.reason) {
    return { allowed: false, reason: 'reason_required' };
  }
  return { allowed: true, selfApproved: true };
}
