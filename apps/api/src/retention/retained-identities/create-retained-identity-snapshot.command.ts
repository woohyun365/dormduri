import { createHash } from 'node:crypto';
import { DEIDENTIFIED_USER_DISPLAY_NAME } from '../../privacy/deidentification/deidentified-display.policy.js';
import { Prisma } from '../../generated/prisma/client.js';
import { ensureRetentionCaseTx } from '../vault/retention-case.repository.js';
import { validateRetainedIdentityMetadata } from './retained-identity-metadata.validator.js';
import { resolveRetainedIdentityDecision } from './retained-identity-decision.policy.js';
import {
  encryptRetainedIdentifierPayload,
  resolveRetainedIdentityCipher,
} from './retained-identity-cipher.js';
import type {
  RetainedIdentifierPlaintext,
  RetainedIdentityCipher,
  RetainedIdentityOwnerOptions,
  RetainedIdentitySnapshotInput,
} from './retained-identity.types.js';

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

function buildAnonymizedActorKey(userId: string, deletedAt: Date) {
  return hashText(`${userId}:${deletedAt.toISOString()}`).slice(0, 24);
}

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
