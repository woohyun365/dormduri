import type { Prisma } from '../../generated/prisma/client.js';
import type { ArchiveJobTarget } from '../../generated/prisma/enums.js';
import {
  CHAT_MESSAGE_IDENTITY_REVIEW_AFTER_DAYS,
  type ArchiveJobWorkItem,
} from './archive-job.types.js';

export function buildArchiveJobPayload(input: {
  target: ArchiveJobTarget;
  deletedAt: Date;
  payload?: Record<string, unknown>;
}) {
  return removeUndefinedValues({
    schemaVersion: 1,
    source: 'ACCOUNT_DELETE',
    target: input.target,
    deletedAt: input.deletedAt.toISOString(),
    ...(input.payload ?? {}),
  });
}

export function buildJobMetadata(job: ArchiveJobWorkItem): Record<string, unknown> {
  return removeUndefinedValues({
    archiveJobId: job.id,
    archiveJobTarget: job.target,
    retainedIdentityId: job.retainedIdentityId,
    userId: job.userId,
    seasonId: job.seasonId,
    participantId: job.participantId,
    matchHistoryEntryId: job.matchHistoryEntryId,
    threadId: job.threadId,
  });
}

export function buildVaultAad(target: string, sourceId: string) {
  return `knu-roommate:retained-vault:${target}:v1:${sourceId}`;
}

export function toVaultJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(toJsonSerializable(value))) as Prisma.InputJsonValue;
}

function toJsonSerializable(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toJsonSerializable(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        toJsonSerializable(entry),
      ]),
    );
  }
  return value;
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1_000);
}

export function resolveChatIdentityReviewAfter(payload: unknown, fallbackFrom: Date) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const identityReviewAfter = (payload as Record<string, unknown>).identityReviewAfter;
    if (typeof identityReviewAfter === 'string') {
      const parsed = new Date(identityReviewAfter);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }
  return addDays(fallbackFrom, CHAT_MESSAGE_IDENTITY_REVIEW_AFTER_DAYS);
}

export function removeUndefinedValues(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
