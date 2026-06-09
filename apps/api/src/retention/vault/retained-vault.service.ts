import { createHmac } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  RetainedVaultObjectTarget,
  RetainedVaultSubjectRole,
  RetentionAccessReason,
  RetentionCaseReason,
} from '../../generated/prisma/enums.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import { createRetentionAccessLog } from '../access-logs/create-retention-access-log.command.js';
import {
  decryptJsonPayload,
  encryptJsonPayload,
  type RetentionCipher,
} from '../crypto/retention-cipher.js';
import {
  parseRetentionVaultKeyPurpose,
  resolveRetentionVaultCipher,
  type RetainedVaultOwnerOptions,
  type RetentionVaultKeyPurpose,
} from './retained-vault-keyring.js';

export type { RetainedVaultOwnerOptions } from './retained-vault-keyring.js';

export interface RetainVaultPayloadInput<TPayload> {
  target: RetainedVaultObjectTarget;
  sourceTable: string;
  sourceId: string;
  archiveJobId?: string | null;
  subjectUserId?: string | null;
  subjectRetainedIdentityId?: string | null;
  subjectParticipantId?: string | null;
  subjectRole: RetainedVaultSubjectRole;
  keyPurpose: RetentionVaultKeyPurpose;
  payloadSchemaVersion: number;
  plaintext: TPayload;
  aad: string;
  retainedAt: Date;
  metadata?: Record<string, unknown> | null;
  retentionCaseId?: string | null;
  holdReason?: RetentionCaseReason | null;
  holdUntil?: Date | null;
}

export interface RetainVaultPayloadResult {
  id: string;
  created: boolean;
}

export interface RetainedVaultDisclosureInput<TPayload> {
  retainedVaultObjectId?: string;
  target?: RetainedVaultObjectTarget;
  sourceId?: string;
  subjectRole?: RetainedVaultSubjectRole;
  accessedBy: string;
  accessReason: RetentionAccessReason;
  approvalReference: string;
  purpose: string;
  now?: Date;
  parsePlaintext: (payload: unknown) => TPayload;
}

export interface RetainedVaultDisclosure<TPayload> {
  retainedVaultObjectId: string;
  target: RetainedVaultObjectTarget;
  sourceTable: string;
  sourceId: string;
  subjectRole: RetainedVaultSubjectRole;
  payload: TPayload;
  keyVersion: string;
  disclosedAt: Date;
}

export interface RetainedVaultDisposalResult {
  processedCount: number;
}

export async function retainVaultPayloadTx<TPayload>(
  tx: Prisma.TransactionClient,
  input: RetainVaultPayloadInput<TPayload>,
  options: RetainedVaultOwnerOptions = {},
): Promise<RetainVaultPayloadResult> {
  const existing = await tx.retainedVaultObject.findFirst({
    where: {
      target: input.target,
      sourceId: input.sourceId,
      subjectRole: input.subjectRole,
    },
    select: { id: true, state: true },
  });

  if (existing) {
    if (existing.state === 'DISPOSED') {
      throw new Error('[retained-vault-owner] disposed vault object cannot be retained again');
    }
    await maybeUpsertHold(tx, existing.id, input);
    return { id: existing.id, created: false };
  }

  const cipher = resolveRetentionVaultCipher(options.keyring, input.keyPurpose);
  if (!cipher) {
    throw new Error(`[retained-vault-owner] ${input.keyPurpose} key unavailable`);
  }

  const encryptedPayload = encryptJsonPayload({
    cipher,
    plaintext: input.plaintext,
    aad: Buffer.from(input.aad),
  });
  const created = await tx.retainedVaultObject.create({
    data: {
      target: input.target,
      sourceTable: input.sourceTable,
      sourceId: input.sourceId,
      archiveJobId: input.archiveJobId ?? undefined,
      subjectUserId: input.subjectUserId ?? undefined,
      subjectRetainedIdentityId: input.subjectRetainedIdentityId ?? undefined,
      subjectParticipantId: input.subjectParticipantId ?? undefined,
      subjectRole: input.subjectRole,
      payloadSchemaVersion: input.payloadSchemaVersion,
      encryptedPayload: encryptedPayload as unknown as Prisma.InputJsonValue,
      payloadDigest: hmacPayloadDigest(cipher, input.plaintext),
      keyPurpose: input.keyPurpose,
      keyVersion: cipher.keyVersion,
      aad: input.aad,
      retainedAt: input.retainedAt,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
    },
    select: { id: true },
  });

  await maybeUpsertHold(tx, created.id, input);
  return { id: created.id, created: true };
}

export async function discloseRetainedVaultPayload<TPayload>(
  prisma: Pick<PrismaService, 'retainedVaultObject' | 'retentionAccessLog'> &
    Partial<Pick<PrismaService, 'retentionReviewJob'>>,
  input: RetainedVaultDisclosureInput<TPayload>,
  options: RetainedVaultOwnerOptions = {},
): Promise<RetainedVaultDisclosure<TPayload>> {
  assertDisclosureInput(input);
  const now = input.now ?? new Date();
  const where = input.retainedVaultObjectId
    ? { id: input.retainedVaultObjectId }
    : input.target && input.sourceId && input.subjectRole
      ? {
          target_sourceId_subjectRole: {
            target: input.target,
            sourceId: input.sourceId,
            subjectRole: input.subjectRole,
          },
        }
      : null;

  if (!where) {
    throw new Error(
      '[retained-vault-owner] retainedVaultObjectId or target/sourceId/subjectRole is required',
    );
  }

  const vaultObject = await prisma.retainedVaultObject.findUnique({
    where,
    select: {
      id: true,
      target: true,
      sourceTable: true,
      sourceId: true,
      subjectRole: true,
      subjectRetainedIdentityId: true,
      encryptedPayload: true,
      keyPurpose: true,
      keyVersion: true,
      aad: true,
      state: true,
      disposedAt: true,
    },
  });

  if (!vaultObject) {
    throw new Error('[retained-vault-owner] retained vault object not found');
  }

  const logBase = {
    retainedVaultObjectId: vaultObject.id,
    retainedIdentityId: vaultObject.subjectRetainedIdentityId,
    accessedBy: input.accessedBy,
    accessReason: input.accessReason,
    approvalReference: input.approvalReference,
    purpose: input.purpose,
    createdAt: now,
  };

  if (vaultObject.state === 'DISPOSED' || vaultObject.disposedAt) {
    await createRetentionAccessLog(prisma, {
      ...logBase,
      targetType: 'VAULT_OBJECT',
      vaultTarget: vaultObject.target,
      result: 'DENIED',
      disclosedFields: [],
    });
    throw new Error('[retained-vault-owner] retained vault object disposed');
  }

  const keyPurpose = parseRetentionVaultKeyPurpose(vaultObject.keyPurpose);
  const cipher = resolveRetentionVaultCipher(options.keyring, keyPurpose);
  if (!cipher || !vaultObject.encryptedPayload) {
    await createRetentionAccessLog(prisma, {
      ...logBase,
      targetType: 'VAULT_OBJECT',
      vaultTarget: vaultObject.target,
      result: 'DENIED',
      disclosedFields: [],
    });
    throw new Error('[retained-vault-owner] retained vault disclosure key unavailable');
  }

  try {
    const payload = decryptJsonPayload({
      cipher,
      payload: vaultObject.encryptedPayload,
      aad: Buffer.from(vaultObject.aad),
      errorPrefix: '[retained-vault-owner] retained payload',
      parsePlaintext: input.parsePlaintext,
    });
    await createRetentionAccessLog(prisma, {
      ...logBase,
      targetType: 'VAULT_OBJECT',
      vaultTarget: vaultObject.target,
      result: 'DISCLOSED',
      disclosedFields: ['payload'],
    });

    return {
      retainedVaultObjectId: vaultObject.id,
      target: vaultObject.target,
      sourceTable: vaultObject.sourceTable,
      sourceId: vaultObject.sourceId,
      subjectRole: vaultObject.subjectRole,
      payload,
      keyVersion: vaultObject.keyVersion ?? cipher.keyVersion,
      disclosedAt: now,
    };
  } catch (error) {
    await createRetentionAccessLog(prisma, {
      ...logBase,
      targetType: 'VAULT_OBJECT',
      vaultTarget: vaultObject.target,
      result: 'DENIED',
      disclosedFields: [],
    });
    throw error;
  }
}

export async function disposeDueRetainedVaultObjects(
  prisma: Pick<PrismaService, 'retainedVaultObject' | 'retentionAccessLog'> &
    Partial<Pick<PrismaService, 'retentionReviewJob'>>,
  now: Date,
): Promise<RetainedVaultDisposalResult> {
  const dueObjects = await prisma.retainedVaultObject.findMany({
    where: {
      state: 'RETAINED',
      holds: {
        some: {},
        every: {
          OR: [{ releasedAt: { not: null } }, { holdUntil: { not: null, lte: now } }],
        },
      },
    },
    select: { id: true, target: true, subjectRetainedIdentityId: true },
    orderBy: [{ retainedAt: 'asc' }, { id: 'asc' }],
  });

  let processedCount = 0;
  for (const object of dueObjects) {
    await prisma.retainedVaultObject.update({
      where: { id: object.id },
      data: {
        encryptedPayload: Prisma.JsonNull,
        payloadDigest: null,
        keyVersion: null,
        state: 'DISPOSED',
        disposedAt: now,
        disposalReason: 'RETENTION_HOLD_EXPIRED',
      },
    });
    await createRetentionAccessLog(prisma, {
      targetType: 'VAULT_OBJECT',
      retainedVaultObjectId: object.id,
      retainedIdentityId: object.subjectRetainedIdentityId,
      vaultTarget: object.target,
      accessedBy: 'SYSTEM',
      accessReason: 'RETENTION_EXPIRY_REVIEW',
      approvalReference: 'SYSTEM_RETENTION_EXPIRY',
      purpose: '보존 기간 만료에 따른 retained vault payload 폐기',
      result: 'DISPOSED',
      disclosedFields: [],
      createdAt: now,
    });
    processedCount += 1;
  }

  return { processedCount };
}

export function hmacPayloadDigest(cipher: RetentionCipher, payload: unknown) {
  return createHmac('sha256', cipher.key).update(stableStringify(payload)).digest('hex');
}

async function maybeUpsertHold<TPayload>(
  tx: Prisma.TransactionClient,
  retainedVaultObjectId: string,
  input: RetainVaultPayloadInput<TPayload>,
) {
  if (!input.retentionCaseId || !input.holdReason) {
    return;
  }

  await tx.retainedVaultObjectHold.upsert({
    where: {
      retainedVaultObjectId_retentionCaseId: {
        retainedVaultObjectId,
        retentionCaseId: input.retentionCaseId,
      },
    },
    update: {
      holdUntil: input.holdUntil ?? undefined,
      releasedAt: null,
      releaseReason: null,
    },
    create: {
      retainedVaultObjectId,
      retentionCaseId: input.retentionCaseId,
      holdReason: input.holdReason,
      holdUntil: input.holdUntil ?? undefined,
    },
  });
}

function assertDisclosureInput(input: {
  accessedBy: string;
  approvalReference: string;
  purpose: string;
}) {
  if (!input.accessedBy.trim()) {
    throw new Error('[retained-vault-owner] accessedBy is required');
  }
  if (!input.approvalReference.trim()) {
    throw new Error('[retained-vault-owner] approvalReference is required');
  }
  if (!input.purpose.trim()) {
    throw new Error('[retained-vault-owner] purpose is required');
  }
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(',')}}`;
}
