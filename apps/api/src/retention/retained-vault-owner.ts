import { createHmac } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import type {
  RetainedVaultObjectTarget,
  RetainedVaultSubjectRole,
  RetentionAccessReason,
  RetentionCaseReason,
} from '../generated/prisma/enums.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import { createRetentionAccessLog } from './retention-access-log-owner.js';
import {
  createRetentionCipher,
  decryptJsonPayload,
  encryptJsonPayload,
  type RetentionCipher,
} from './retention-cipher.js';

const DEFAULT_VAULT_KEY_VERSION = 'local-v1';
const POLICY_VERSION = 'rrpd-v1';

export type RetentionVaultKeyPurpose =
  | 'IDENTITY'
  | 'CHAT_BODY'
  | 'NICKNAME_AUDIT'
  | 'SEASON_PROFILE_HISTORY'
  | 'MATCH_HISTORY';

export interface RetentionVaultKeyring {
  getCipher(purpose: RetentionVaultKeyPurpose): RetentionCipher | null;
}

export interface RetainedVaultOwnerOptions {
  keyring?: RetentionVaultKeyring;
}

export interface EnsureRetentionCaseInput {
  reason: RetentionCaseReason;
  triggerUserId?: string | null;
  triggerRetainedIdentityId?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  retentionHoldUntil?: Date | null;
  legalHoldReason?:
    | 'LAW_ENFORCEMENT_REQUEST'
    | 'INTERNAL_DISPUTE_REVIEW'
    | 'SAFETY_INCIDENT'
    | 'ADMIN_LEGAL_REVIEW'
    | null;
  approvalReference?: string | null;
  metadata?: Record<string, unknown> | null;
}

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

export interface RetainedNicknameAuditPayload {
  schemaVersion: 1;
  event: Record<string, unknown>;
}

export interface RetainedSeasonProfileHistoryPayload {
  schemaVersion: 1;
  history: Record<string, unknown>;
}

export interface RetainedMatchHistoryPayload {
  schemaVersion: 1;
  subjectRole: 'VIEWER' | 'COUNTERPART';
  entry: Record<string, unknown>;
}

export function parseRetainedNicknameAuditPayload(payload: unknown): RetainedNicknameAuditPayload {
  const candidate = asRecord(payload, '[retained-vault-owner] nickname audit payload invalid');
  const event = asRecord(candidate.event, '[retained-vault-owner] nickname audit payload invalid');
  if (candidate.schemaVersion !== 1 || typeof event.id !== 'string') {
    throw new Error('[retained-vault-owner] nickname audit payload invalid');
  }

  return { schemaVersion: 1, event };
}

export function parseRetainedSeasonProfileHistoryPayload(
  payload: unknown,
): RetainedSeasonProfileHistoryPayload {
  const candidate = asRecord(payload, '[retained-vault-owner] profile history payload invalid');
  const history = asRecord(
    candidate.history,
    '[retained-vault-owner] profile history payload invalid',
  );
  if (
    candidate.schemaVersion !== 1 ||
    typeof history.id !== 'string' ||
    typeof history.participantId !== 'string'
  ) {
    throw new Error('[retained-vault-owner] profile history payload invalid');
  }

  return { schemaVersion: 1, history };
}

export function parseRetainedMatchHistoryPayload(payload: unknown): RetainedMatchHistoryPayload {
  const candidate = asRecord(payload, '[retained-vault-owner] match history payload invalid');
  const entry = asRecord(candidate.entry, '[retained-vault-owner] match history payload invalid');
  if (
    candidate.schemaVersion !== 1 ||
    (candidate.subjectRole !== 'VIEWER' && candidate.subjectRole !== 'COUNTERPART') ||
    typeof entry.id !== 'string'
  ) {
    throw new Error('[retained-vault-owner] match history payload invalid');
  }

  return { schemaVersion: 1, subjectRole: candidate.subjectRole, entry };
}

export function createRetentionVaultCipher(input: {
  key: string | Buffer;
  keyVersion: string;
}): RetentionCipher {
  return createRetentionCipher({
    key: input.key,
    keyVersion: input.keyVersion,
    errorPrefix: '[retained-vault-owner]',
  });
}

export function createStaticRetentionVaultKeyring(
  ciphers: Partial<Record<RetentionVaultKeyPurpose, RetentionCipher | null>>,
): RetentionVaultKeyring {
  return {
    getCipher(purpose) {
      return ciphers[purpose] ?? null;
    },
  };
}

export function createEnvRetentionVaultKeyring(): RetentionVaultKeyring {
  return {
    getCipher(purpose) {
      const key = process.env[`RETENTION_VAULT_${purpose}_ENCRYPTION_KEY_BASE64`]?.trim();
      if (!key) {
        return null;
      }

      const keyVersion =
        process.env[`RETENTION_VAULT_${purpose}_KEY_VERSION`]?.trim() || DEFAULT_VAULT_KEY_VERSION;
      return createRetentionVaultCipher({ key, keyVersion });
    },
  };
}

export async function ensureRetentionCaseTx(
  tx: Prisma.TransactionClient,
  input: EnsureRetentionCaseInput,
) {
  const existing = await tx.retentionCase.findFirst({
    where: {
      reason: input.reason,
      triggerRetainedIdentityId: input.triggerRetainedIdentityId ?? null,
      sourceTable: input.sourceTable ?? null,
      sourceId: input.sourceId ?? null,
    },
    select: { id: true },
  });
  if (existing) {
    return existing;
  }

  return tx.retentionCase.create({
    data: {
      reason: input.reason,
      triggerUserId: input.triggerUserId ?? undefined,
      triggerRetainedIdentityId: input.triggerRetainedIdentityId ?? undefined,
      sourceTable: input.sourceTable ?? undefined,
      sourceId: input.sourceId ?? undefined,
      retentionHoldUntil: input.retentionHoldUntil ?? undefined,
      legalHoldReason: input.legalHoldReason ?? undefined,
      approvalReference: input.approvalReference ?? undefined,
      policyVersion: POLICY_VERSION,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
    },
    select: { id: true },
  });
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

function resolveRetentionVaultCipher(
  keyring: RetentionVaultKeyring | undefined,
  purpose: RetentionVaultKeyPurpose,
) {
  return (keyring ?? createEnvRetentionVaultKeyring()).getCipher(purpose);
}

function parseRetentionVaultKeyPurpose(value: string): RetentionVaultKeyPurpose {
  if (
    value === 'IDENTITY' ||
    value === 'CHAT_BODY' ||
    value === 'NICKNAME_AUDIT' ||
    value === 'SEASON_PROFILE_HISTORY' ||
    value === 'MATCH_HISTORY'
  ) {
    return value;
  }
  throw new Error('[retained-vault-owner] unsupported key purpose');
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

function asRecord(value: unknown, errorMessage: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(errorMessage);
  }
  return value as Record<string, unknown>;
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
