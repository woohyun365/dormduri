import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import type { ArchiveJobWorkItem } from '../../../retention/archive-jobs/archive-job.types.js';

const mocks = vi.hoisted(() => ({
  loadRetainedIdentityForCaseTx: vi.fn(),
  ensureRetentionCaseTx: vi.fn(),
  retainVaultPayloadTx: vi.fn(),
}));

vi.mock('../../../retention/retained-identities/retained-identity-hold.query.js', () => ({
  loadRetainedIdentityForCaseTx: mocks.loadRetainedIdentityForCaseTx,
}));
vi.mock('../../../retention/vault/retention-case.repository.js', () => ({
  ensureRetentionCaseTx: mocks.ensureRetentionCaseTx,
}));
vi.mock('../../../retention/vault/retained-vault.service.js', () => ({
  retainVaultPayloadTx: mocks.retainVaultPayloadTx,
}));

import { archiveMatchHistoryJob } from './match-history-archive.handler.js';

describe('match history retention archive', () => {
  it('viewer 또는 counterpart를 비식별화하면 공개 compatibility를 함께 제거한다', async () => {
    mocks.loadRetainedIdentityForCaseTx.mockResolvedValue({
      retentionCaseReason: 'ACCOUNT_DELETION',
      retentionHoldUntil: new Date('2031-01-01T00:00:00.000Z'),
      legalHoldReason: null,
    });
    mocks.ensureRetentionCaseTx.mockResolvedValue({ id: 'case-1' });
    mocks.retainVaultPayloadTx.mockResolvedValue({ id: 'vault-1' });

    const update = vi
      .fn<(input: { where: { id: string }; data: Record<string, unknown> }) => Promise<void>>()
      .mockResolvedValue(undefined);
    const tx = {
      seasonMatchHistoryEntry: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'history-1',
          viewerParticipantId: 'viewer-participant',
          counterpartParticipantId: 'counterpart-participant',
          viewerParticipant: { id: 'viewer-participant', userId: 'user-1' },
          counterpartParticipant: { id: 'counterpart-participant', userId: 'user-2' },
        }),
        update,
      },
      seasonMatchHistoryEntryRetentionLink: {
        upsert: vi.fn().mockResolvedValue(undefined),
      },
    };
    const prisma = {
      runSerializableTransaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    } as unknown as PrismaService;
    const now = new Date('2026-07-01T00:00:00.000Z');

    await expect(archiveMatchHistoryJob(prisma, makeArchiveJob(), now, {})).resolves.toEqual({
      ok: true,
    });

    const updateInput = update.mock.calls[0]?.[0];
    expect(updateInput?.where).toEqual({ id: 'history-1' });
    expect(updateInput?.data.compatibilitySnapshot).toBe(Prisma.DbNull);
    expect(updateInput?.data.compatibilitySchemaVersion).toBeNull();
    expect(updateInput?.data.viewerRedactedAt).toBe(now);
    expect(updateInput?.data.matchScore).toBeNull();
  });
});

function makeArchiveJob(): ArchiveJobWorkItem {
  return {
    id: 'job-1',
    target: 'MATCH_HISTORY',
    status: 'PENDING',
    retainedIdentityId: 'retained-1',
    userId: 'user-1',
    seasonId: 'season-1',
    participantId: 'viewer-participant',
    matchHistoryEntryId: 'history-1',
    threadId: null,
    attemptCount: 1,
    maxAttempts: 5,
    nextRunAt: new Date('2026-07-01T00:00:00.000Z'),
    lastErrorCode: null,
    manualReviewRequired: false,
    payload: null,
  };
}
