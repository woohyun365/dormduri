import { createHash } from 'node:crypto';
import { DEIDENTIFIED_USER_DISPLAY_NAME } from '../common/deidentification/deidentified-display.owner.js';
import { Prisma } from '../generated/prisma/client.js';
import type { RetentionAccessReason } from '../generated/prisma/enums.js';
import type { PrismaService } from '../platform/database/prisma.service.js';
import { validateRetainedIdentityMetadata } from './retained-identity-metadata.validator.js';
import { disposeDueRetainedVaultObjects, ensureRetentionCaseTx } from './retained-vault-owner.js';
import { createRetentionAccessLog } from './retention-access-log-owner.js';
import {
  decryptJsonPayload,
  encryptJsonPayload,
  type EncryptedRetentionPayload,
  type RetentionCipher,
  createRetentionCipher,
} from './retention-cipher.js';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1_000;
const THREE_YEARS_DAYS = 365 * 3;
const RETAINED_IDENTIFIER_KEY_ENV = 'RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64';
const RETAINED_IDENTIFIER_KEY_VERSION_ENV = 'RETENTION_IDENTITY_KEY_VERSION';
const DEFAULT_RETAINED_IDENTIFIER_KEY_VERSION = 'local-v1';
const RETAINED_IDENTIFIER_AAD = Buffer.from('knu-roommate:retained-identity:v1');

interface RetainedIdentifierPlaintext {
  schemaVersion: 1;
  originalUserId: string;
  email: string;
  emailNormalized: string;
}

type EncryptedRetainedIdentifierPayload = EncryptedRetentionPayload;

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

export function resolveRetainedIdentityDecision(input: RetainedIdentityDecisionInput) {
  if (input.legalHoldReason) {
    return {
      retentionCaseReason: 'LEGAL_HOLD' as const,
      legalHoldReason: input.legalHoldReason,
      holdUntil: input.manualRetentionUntil ?? null,
    };
  }

  if (input.disputeOpen) {
    return {
      retentionCaseReason: 'DISPUTE_RESPONSE' as const,
      legalHoldReason: null,
      holdUntil: addDays(input.deletedAt, THREE_YEARS_DAYS),
    };
  }

  if (input.reportOpen) {
    return {
      retentionCaseReason: 'REPORT_REVIEW' as const,
      legalHoldReason: null,
      holdUntil: addDays(input.deletedAt, THREE_YEARS_DAYS),
    };
  }

  if (input.enforcementRecord) {
    return {
      retentionCaseReason: 'ENFORCEMENT_RECORD' as const,
      legalHoldReason: null,
      holdUntil: addDays(input.deletedAt, THREE_YEARS_DAYS),
    };
  }

  return {
    retentionCaseReason: 'ACCOUNT_DELETION' as const,
    legalHoldReason: null,
    holdUntil: new Date(input.deletedAt.getTime() + FIVE_DAYS_MS),
  };
}

export function createRetainedIdentityOwner(
  prisma: PrismaService,
  options: RetainedIdentityOwnerOptions = {},
) {
  return {
    async createRetainedIdentitySnapshot(input: RetainedIdentitySnapshotInput) {
      return prisma.runSerializableTransaction(async (tx) => {
        return createRetainedIdentitySnapshotTx(tx, input, options);
      });
    },
    discloseRetainedIdentityIdentifiers(input: RetainedIdentityDisclosureInput) {
      return discloseRetainedIdentityIdentifiers(prisma, input, options);
    },
    disposeExpiredRetainedIdentities(now: Date) {
      return disposeExpiredRetainedIdentities(prisma, now);
    },
  };
}

export async function createRetainedIdentitySnapshotTx(
  tx: Prisma.TransactionClient,
  input: RetainedIdentitySnapshotInput,
  options: RetainedIdentityOwnerOptions = {},
) {
  const metadata = validateRetainedIdentityMetadata(input.metadata);
  const decision = resolveRetainedIdentityDecision(input);
  const user = await tx.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      emailNormalized: true,
      deletedAt: true,
    },
  });

  if (!user) {
    throw new Error('[retained-identity-owner] user not found');
  }

  if (user.deletedAt) {
    const existingIdentity = await tx.retainedIdentity.findFirst({
      where: {
        OR: [
          { originalUserId: user.id },
          { anonymizedActorKey: buildAnonymizedActorKey(user.id, user.deletedAt) },
        ],
      },
      select: {
        id: true,
        originalUserId: true,
        retentionDisposedAt: true,
      },
    });

    if (
      !existingIdentity ||
      existingIdentity.originalUserId !== user.id ||
      existingIdentity.retentionDisposedAt
    ) {
      throw new Error('[retained-identity-owner] retained identity anchor disposed');
    }
  }

  const encryptedIdentifierData = resolveEncryptedIdentifierData(
    {
      schemaVersion: 1,
      originalUserId: user.id,
      email: user.email,
      emailNormalized: user.emailNormalized,
    },
    resolveRetainedIdentityCipher(options.identifierCipher),
  );

  const retainedIdentity = await tx.retainedIdentity.upsert({
    where: { originalUserId: user.id },
    update: {
      displayLabel: DEIDENTIFIED_USER_DISPLAY_NAME,
      deletedAt: input.deletedAt,
      emailHash: hashText(user.emailNormalized),
      ...encryptedIdentifierData,
      retentionDisposedAt: null,
      retentionDisposalReason: null,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    create: {
      originalUserId: user.id,
      anonymizedActorKey: buildAnonymizedActorKey(user.id, input.deletedAt),
      displayLabel: DEIDENTIFIED_USER_DISPLAY_NAME,
      deletedAt: input.deletedAt,
      emailHash: hashText(user.emailNormalized),
      ...encryptedIdentifierData,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  const retentionCase = await ensureRetentionCaseTx(tx, {
    reason: decision.retentionCaseReason,
    triggerUserId: user.id,
    triggerRetainedIdentityId: retainedIdentity.id,
    sourceTable: 'RetainedIdentity',
    sourceId: retainedIdentity.id,
    retentionHoldUntil: decision.holdUntil,
    legalHoldReason: decision.legalHoldReason,
    metadata: metadata ? { retainedIdentityMetadata: metadata } : null,
  });

  await tx.retainedIdentityHold.upsert({
    where: {
      retainedIdentityId_retentionCaseId: {
        retainedIdentityId: retainedIdentity.id,
        retentionCaseId: retentionCase.id,
      },
    },
    update: {
      holdReason: decision.retentionCaseReason,
      holdUntil: decision.holdUntil ?? undefined,
      releasedAt: null,
      releaseReason: null,
    },
    create: {
      retainedIdentityId: retainedIdentity.id,
      retentionCaseId: retentionCase.id,
      holdReason: decision.retentionCaseReason,
      holdUntil: decision.holdUntil ?? undefined,
    },
  });

  return {
    ...retainedIdentity,
    retentionCaseReason: decision.retentionCaseReason,
    retentionHoldUntil: decision.holdUntil,
    legalHoldReason: decision.legalHoldReason,
  };
}

export async function discloseRetainedIdentityIdentifiers(
  prisma: Pick<PrismaService, 'retainedIdentity' | 'retentionAccessLog'> &
    Partial<Pick<PrismaService, 'retentionReviewJob'>>,
  input: RetainedIdentityDisclosureInput,
  options: RetainedIdentityOwnerOptions = {},
): Promise<RetainedIdentityDisclosure> {
  assertDisclosureInput(input);

  const now = input.now ?? new Date();
  const retainedIdentity = await prisma.retainedIdentity.findUnique({
    where: { id: input.retainedIdentityId },
    select: {
      id: true,
      encryptedIdentifierPayload: true,
      retentionDisposedAt: true,
    },
  });

  if (!retainedIdentity) {
    throw new Error('[retained-identity-owner] retained identity not found');
  }

  const deniedLogInput = {
    retainedIdentityId: retainedIdentity.id,
    accessedBy: input.accessedBy,
    accessReason: input.accessReason,
    approvalReference: input.approvalReference,
    purpose: input.purpose,
    createdAt: now,
  };

  if (retainedIdentity.retentionDisposedAt) {
    await createRetentionAccessLog(prisma, {
      ...deniedLogInput,
      targetType: 'IDENTITY_ANCHOR',
      result: 'DENIED',
      disclosedFields: [],
    });
    throw new Error('[retained-identity-owner] retained identity identifiers disposed');
  }

  const cipher = resolveRetainedIdentityCipher(options.identifierCipher);
  if (!cipher || !retainedIdentity.encryptedIdentifierPayload) {
    await createRetentionAccessLog(prisma, {
      ...deniedLogInput,
      targetType: 'IDENTITY_ANCHOR',
      result: 'DENIED',
      disclosedFields: [],
    });
    throw new Error('[retained-identity-owner] retained identity disclosure key unavailable');
  }

  try {
    const identifiers = decryptRetainedIdentifierPayload(
      cipher,
      retainedIdentity.encryptedIdentifierPayload,
    );
    await createRetentionAccessLog(prisma, {
      retainedIdentityId: retainedIdentity.id,
      targetType: 'IDENTITY_ANCHOR',
      accessedBy: input.accessedBy,
      accessReason: input.accessReason,
      approvalReference: input.approvalReference,
      purpose: input.purpose,
      result: 'DISCLOSED',
      disclosedFields: ['originalUserId', 'email', 'emailNormalized'],
      createdAt: now,
    });

    return {
      retainedIdentityId: retainedIdentity.id,
      originalUserId: identifiers.originalUserId,
      email: identifiers.email,
      emailNormalized: identifiers.emailNormalized,
      keyVersion: cipher.keyVersion,
      disclosedAt: now,
    };
  } catch (error) {
    await createRetentionAccessLog(prisma, {
      ...deniedLogInput,
      targetType: 'IDENTITY_ANCHOR',
      result: 'DENIED',
      disclosedFields: [],
    });
    throw error;
  }
}

export async function disposeExpiredRetainedIdentities(
  prisma: Pick<
    PrismaService,
    'retainedIdentity' | 'retainedVaultObject' | 'retentionAccessLog' | 'retentionReviewJob'
  >,
  now: Date,
): Promise<RetainedIdentityDisposalResult> {
  const dueIdentities = await prisma.retainedIdentity.findMany({
    where: {
      retentionDisposedAt: null,
      holds: {
        some: {},
        every: {
          OR: [{ releasedAt: { not: null } }, { holdUntil: { not: null, lte: now } }],
        },
      },
    },
    select: { id: true },
    orderBy: [{ deletedAt: 'asc' }, { id: 'asc' }],
  });

  let processedCount = 0;
  for (const identity of dueIdentities) {
    await prisma.retainedIdentity.update({
      where: { id: identity.id },
      data: {
        originalUserId: null,
        emailHash: null,
        encryptedIdentifierPayload: Prisma.JsonNull,
        identifierKeyVersion: null,
        retentionDisposedAt: now,
        retentionDisposalReason: 'RETENTION_HOLD_EXPIRED',
      },
    });
    await createRetentionAccessLog(prisma, {
      retainedIdentityId: identity.id,
      targetType: 'IDENTITY_ANCHOR',
      accessedBy: 'SYSTEM',
      accessReason: 'RETENTION_EXPIRY_REVIEW',
      approvalReference: 'SYSTEM_RETENTION_EXPIRY',
      purpose: '보존 기간 만료에 따른 식별 복원 anchor 폐기',
      result: 'DISPOSED',
      disclosedFields: [],
      createdAt: now,
    });
    processedCount += 1;
  }

  const vaultDisposal = await disposeDueRetainedVaultObjects(prisma, now);

  return { processedCount: processedCount + vaultDisposal.processedCount };
}

export function createRetainedIdentityCipher(input: {
  key: string | Buffer;
  keyVersion: string;
}): RetainedIdentityCipher {
  return createRetentionCipher({
    key: input.key,
    keyVersion: input.keyVersion,
    errorPrefix: '[retained-identity-owner]',
  });
}

export function encryptRetainedIdentifierPayload(
  cipher: RetainedIdentityCipher,
  plaintext: RetainedIdentifierPlaintext,
): EncryptedRetainedIdentifierPayload {
  return encryptJsonPayload({
    cipher,
    plaintext,
    aad: RETAINED_IDENTIFIER_AAD,
  });
}

export function decryptRetainedIdentifierPayload(
  cipher: RetainedIdentityCipher,
  payload: unknown,
): RetainedIdentifierPlaintext {
  return decryptJsonPayload({
    cipher,
    payload,
    aad: RETAINED_IDENTIFIER_AAD,
    errorPrefix: '[retained-identity-owner] retained identity',
    parsePlaintext: parseRetainedIdentifierPlaintext,
  });
}

function resolveEncryptedIdentifierData(
  plaintext: RetainedIdentifierPlaintext,
  cipher: RetainedIdentityCipher | null,
) {
  if (!cipher) {
    return {};
  }

  return {
    encryptedIdentifierPayload: encryptRetainedIdentifierPayload(
      cipher,
      plaintext,
    ) as unknown as Prisma.InputJsonValue,
    identifierKeyVersion: cipher.keyVersion,
  };
}

function resolveRetainedIdentityCipher(
  cipherOverride: RetainedIdentityCipher | null | undefined,
): RetainedIdentityCipher | null {
  if (cipherOverride !== undefined) {
    return cipherOverride;
  }

  const rawKey = process.env[RETAINED_IDENTIFIER_KEY_ENV]?.trim();
  if (!rawKey) {
    return null;
  }

  return createRetainedIdentityCipher({
    key: rawKey,
    keyVersion:
      process.env[RETAINED_IDENTIFIER_KEY_VERSION_ENV]?.trim() ||
      DEFAULT_RETAINED_IDENTIFIER_KEY_VERSION,
  });
}

function assertDisclosureInput(input: RetainedIdentityDisclosureInput) {
  if (!input.accessedBy.trim()) {
    throw new Error('[retained-identity-owner] accessedBy is required');
  }
  if (!input.approvalReference.trim()) {
    throw new Error('[retained-identity-owner] approvalReference is required');
  }
  if (!input.purpose.trim()) {
    throw new Error('[retained-identity-owner] purpose is required');
  }
}

function parseRetainedIdentifierPlaintext(payload: unknown): RetainedIdentifierPlaintext {
  if (!payload || typeof payload !== 'object') {
    throw new Error('[retained-identity-owner] identifier plaintext invalid');
  }

  const candidate = payload as Partial<Record<keyof RetainedIdentifierPlaintext, unknown>>;
  if (
    candidate.schemaVersion !== 1 ||
    typeof candidate.originalUserId !== 'string' ||
    typeof candidate.email !== 'string' ||
    typeof candidate.emailNormalized !== 'string'
  ) {
    throw new Error('[retained-identity-owner] identifier plaintext invalid');
  }

  return candidate as RetainedIdentifierPlaintext;
}

function buildAnonymizedActorKey(userId: string, deletedAt: Date) {
  return hashText(`${userId}:${deletedAt.toISOString()}`).slice(0, 24);
}

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1_000);
}
