import type { RetentionAccessReason, RetentionCaseReason } from '../../generated/prisma/enums.js';
import type { EncryptedRetentionPayload, RetentionCipher } from '../crypto/retention-cipher.js';

export interface RetainedIdentifierPlaintext {
  schemaVersion: 1;
  originalUserId: string;
  email: string;
  emailNormalized: string;
}

export type EncryptedRetainedIdentifierPayload = EncryptedRetentionPayload;

export interface RetainedIdentityDecisionInput {
  deletedAt: Date;
  disputeOpen?: boolean;
  reportOpen?: boolean;
  enforcementRecord?: boolean;
  legalHoldReason?:
    | 'LAW_ENFORCEMENT_REQUEST'
    | 'INTERNAL_DISPUTE_REVIEW'
    | 'SAFETY_INCIDENT'
    | 'ADMIN_LEGAL_REVIEW'
    | null;
  manualRetentionUntil?: Date | null;
}

export interface RetainedIdentityDecision {
  retentionCaseReason: RetentionCaseReason;
  legalHoldReason: RetainedIdentityDecisionInput['legalHoldReason'];
  holdUntil: Date | null;
}

export interface RetainedIdentitySnapshotInput extends RetainedIdentityDecisionInput {
  userId: string;
  metadata?: unknown;
}

export type RetainedIdentityCipher = RetentionCipher;

export interface RetainedIdentityOwnerOptions {
  identifierCipher?: RetainedIdentityCipher | null;
}

export interface RetainedIdentityDisclosureInput {
  retainedIdentityId: string;
  accessedBy: string;
  accessReason: RetentionAccessReason;
  approvalReference: string;
  purpose: string;
  now?: Date;
}

export interface RetainedIdentityDisclosure {
  retainedIdentityId: string;
  originalUserId: string;
  email: string;
  emailNormalized: string;
  keyVersion: string;
  disclosedAt: Date;
}

export interface RetainedIdentityDisposalResult {
  processedCount: number;
}
