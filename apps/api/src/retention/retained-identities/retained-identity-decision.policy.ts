import type {
  RetainedIdentityDecision,
  RetainedIdentityDecisionInput,
} from './retained-identity.types.js';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1_000;
const THREE_YEARS_DAYS = 365 * 3;

export function resolveRetainedIdentityDecision(
  input: RetainedIdentityDecisionInput,
): RetainedIdentityDecision {
  if (input.legalHoldReason) {
    return {
      retentionCaseReason: 'LEGAL_HOLD',
      legalHoldReason: input.legalHoldReason,
      holdUntil: input.manualRetentionUntil ?? null,
    };
  }

  if (input.disputeOpen) {
    return {
      retentionCaseReason: 'DISPUTE_RESPONSE',
      legalHoldReason: null,
      holdUntil: addDays(input.deletedAt, THREE_YEARS_DAYS),
    };
  }

  if (input.reportOpen) {
    return {
      retentionCaseReason: 'REPORT_REVIEW',
      legalHoldReason: null,
      holdUntil: addDays(input.deletedAt, THREE_YEARS_DAYS),
    };
  }

  if (input.enforcementRecord) {
    return {
      retentionCaseReason: 'ENFORCEMENT_RECORD',
      legalHoldReason: null,
      holdUntil: addDays(input.deletedAt, THREE_YEARS_DAYS),
    };
  }

  return {
    retentionCaseReason: 'ACCOUNT_DELETION',
    legalHoldReason: null,
    holdUntil: new Date(input.deletedAt.getTime() + FIVE_DAYS_MS),
  };
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1_000);
}
