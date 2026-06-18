import { describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../../auth/application/auth-password-hash.js';
import type {
  PrismaService,
  RetentionWorkerPrismaService,
} from '../../platform/database/prisma.service.js';
import type { SeasonContextPort } from '../../seasons/ports/season-context.port.js';
import { createRequestAccountDeletionCommand } from './request-account-deletion.command.js';

const NOW = new Date('2026-05-24T00:00:00.000Z');

function makeSeasonContext() {
  return {
    state: 'SEASON_MATCHING',
    season: { id: 'season-1' },
    schedule: { seasonEnd: '2026-06-30' },
  };
}

function makeDraftParticipant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'participant-1',
    participationIntent: 'UNDECIDED',
    registeredAt: null,
    declinedAt: null,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'SELECTED',
    participantStatus: 'DRAFT',
    hiddenByAdminAt: null,
    deactivatedAt: null,
    profile: { participantId: 'participant-1' },
    ...overrides,
  };
}

async function makeDeps(
  options: {
    password?: string;
    deletedAt?: Date | null;
    seasonContext?: ReturnType<typeof makeSeasonContext> | null;
    precheckParticipant?: ReturnType<typeof makeDraftParticipant> | null;
    tx?: unknown;
  } = {},
) {
  const passwordHash = await hashPassword(options.password ?? 'Pass1234');
  const tx =
    options.tx ??
    ({
      user: { findUnique: vi.fn() },
      seasonParticipant: { findUnique: vi.fn() },
    } satisfies Record<string, unknown>);
  const prisma = {
    getDatabaseNow: vi.fn().mockResolvedValue(NOW),
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'user-1',
        campus: 'CHUNCHEON',
        passwordHash,
        deletedAt: options.deletedAt ?? null,
      }),
    },
    seasonParticipant: {
      findUnique: vi.fn().mockResolvedValue(options.precheckParticipant ?? null),
    },
  };
  const retentionWorkerPrisma = {
    runSerializableTransaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  const seasonsService = {
    getCurrentSeasonContext: vi.fn().mockResolvedValue(options.seasonContext ?? null),
  };

  return {
    command: createRequestAccountDeletionCommand({
      prisma: prisma as unknown as PrismaService,
      retentionWorkerPrisma: retentionWorkerPrisma as unknown as RetentionWorkerPrismaService,
      seasonsService: seasonsService as unknown as SeasonContextPort,
    }),
    prisma,
    retentionWorkerPrisma,
    seasonsService,
    tx,
  };
}

describe('createRequestAccountDeletionCommand', () => {
  it('password mismatch는 transaction/write 없이 ACCOUNT_DELETION_PASSWORD_MISMATCH로 거부한다', async () => {
    const { command, retentionWorkerPrisma } = await makeDeps({ password: 'Pass1234' });

    await expect(
      command.requestAccountDeletion('user-1', { password: 'Wrong1234' }),
    ).rejects.toMatchObject({
      response: { code: 'ACCOUNT_DELETION_PASSWORD_MISMATCH' },
    });
    expect(retentionWorkerPrisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('already deleted precheck는 transaction/write 없이 ACCOUNT_ALREADY_DELETED로 거부한다', async () => {
    const { command, retentionWorkerPrisma } = await makeDeps({ deletedAt: NOW });

    await expect(
      command.requestAccountDeletion('user-1', { password: 'Pass1234' }),
    ).rejects.toMatchObject({
      response: { code: 'ACCOUNT_ALREADY_DELETED' },
    });
    expect(retentionWorkerPrisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('current season registered participant precheck는 transaction/write 없이 fail-closed 한다', async () => {
    const registeredParticipant = makeDraftParticipant({
      participationIntent: 'REGISTERED',
      registeredAt: NOW,
      dormitorySelectionState: 'ASSIGNED',
      participantStatus: 'ACTIVE',
    });
    const { command, retentionWorkerPrisma } = await makeDeps({
      seasonContext: makeSeasonContext(),
      precheckParticipant: registeredParticipant,
    });

    await expect(
      command.requestAccountDeletion('user-1', { password: 'Pass1234' }),
    ).rejects.toMatchObject({
      response: {
        code: 'ACCOUNT_DELETION_BLOCKED_BY_SEASON_PARTICIPATION',
        seasonState: 'SEASON_MATCHING',
        seasonEndDate: '2026-06-30',
      },
    });
    expect(retentionWorkerPrisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('transaction 내부에서 current season registration 상태를 다시 확인해 deletion/finalize race를 fail-closed 한다', async () => {
    const txRegisteredParticipant = makeDraftParticipant({
      participationIntent: 'REGISTERED',
      registeredAt: NOW,
      dormitorySelectionState: 'ASSIGNED',
      participantStatus: 'ACTIVE',
    });
    const txParticipantFindUnique = vi.fn().mockResolvedValue(txRegisteredParticipant);
    const retainedIdentityUpsert = vi.fn();
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          deletedAt: null,
          displayIdentity: {
            nickname: '기존닉네임',
            nicknameNormalized: '기존닉네임',
          },
        }),
      },
      seasonParticipant: {
        findUnique: txParticipantFindUnique,
      },
      retainedIdentity: {
        upsert: retainedIdentityUpsert,
      },
    };
    const { command, prisma } = await makeDeps({
      seasonContext: makeSeasonContext(),
      precheckParticipant: makeDraftParticipant(),
      tx,
    });

    await expect(
      command.requestAccountDeletion('user-1', { password: 'Pass1234' }),
    ).rejects.toMatchObject({
      response: {
        code: 'ACCOUNT_DELETION_BLOCKED_BY_SEASON_PARTICIPATION',
      },
    });
    expect(prisma.seasonParticipant.findUnique).toHaveBeenCalledTimes(1);
    expect(txParticipantFindUnique).toHaveBeenCalledTimes(1);
    expect(retainedIdentityUpsert).not.toHaveBeenCalled();
  });

  it('transaction user display identity가 없으면 기존 invariant error를 유지한다', async () => {
    const tx = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'user-1',
          deletedAt: null,
          displayIdentity: null,
        }),
      },
      seasonParticipant: {
        findUnique: vi.fn(),
      },
    };
    const { command } = await makeDeps({ tx });

    await expect(
      command.requestAccountDeletion('user-1', { password: 'Pass1234' }),
    ).rejects.toThrow('[UserDeletionOwner] user display identity row is required');
  });

  it('accepted path는 retained snapshot/archive/session revoke/de-identification writes를 같은 tx에서 수행한다', async () => {
    const retentionHoldUntil = new Date('2026-05-29T00:00:00.000Z');
    const tx = {
      user: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'user-1',
            deletedAt: null,
            displayIdentity: {
              nickname: '기존닉네임',
              nicknameNormalized: '기존닉네임',
            },
          })
          .mockResolvedValueOnce({
            id: 'user-1',
            email: 'student@kangwon.ac.kr',
            emailNormalized: 'student@kangwon.ac.kr',
            deletedAt: null,
          }),
        update: vi.fn().mockResolvedValue({ id: 'user-1' }),
      },
      seasonParticipant: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      retainedIdentity: {
        upsert: vi.fn().mockResolvedValue({
          id: 'retained-1',
          originalUserId: 'user-1',
          anonymizedActorKey: 'anon-key',
          displayLabel: '탈퇴한 사용자',
          deletedAt: NOW,
        }),
      },
      retentionCase: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'case-1' }),
      },
      retainedIdentityHold: {
        upsert: vi.fn().mockResolvedValue({ id: 'hold-1' }),
      },
      seasonParticipantProfileHistory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      seasonMatchHistoryEntry: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      conversationThread: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      userDisplayIdentityNicknameChangeEvent: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      userAcademicIdentityChangeEvent: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      archiveJob: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      authSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
      userDisplayIdentity: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      userAcademicIdentity: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      userAcademicIdentityChangeAllowance: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      seasonParticipantProfile: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    tx.retainedIdentity.upsert.mockImplementation(
      (args: { create: { retentionHoldUntil?: Date } }) =>
        Promise.resolve({
          id: 'retained-1',
          originalUserId: 'user-1',
          anonymizedActorKey: 'anon-key',
          displayLabel: '탈퇴한 사용자',
          deletedAt: NOW,
          retentionHoldUntil: args.create.retentionHoldUntil ?? retentionHoldUntil,
        }),
    );
    const { command } = await makeDeps({ tx });

    await expect(
      command.requestAccountDeletion('user-1', { password: 'Pass1234' }),
    ).resolves.toEqual({
      state: 'DEIDENTIFIED_RETAINED',
      deletedAt: NOW.toISOString(),
      retentionHoldUntil: retentionHoldUntil.toISOString(),
    });
    type RetainedIdentityUpsertArgs = {
      create: { metadata?: { schemaVersion?: number; request?: { requestedBy?: string } } };
      update: { metadata?: { schemaVersion?: number } };
    };
    type ArchiveJobCreateManyArgs = {
      data: Array<{ target?: string; userId?: string }>;
    };
    type DisplayAuditCreateArgs = {
      data: {
        source?: string;
        nextNickname?: string;
        nextNicknameNormalized?: string;
        metadata?: { priority?: string };
      };
    };
    type SeasonParticipantProfileUpdateArgs = {
      where: { participant: { userId: string } };
      data: {
        nicknameSnapshot?: string;
        nicknameNormalizedSnapshot?: string;
        intro?: string;
      };
    };

    const [[retainedUpsertArgs]] = tx.retainedIdentity.upsert.mock.calls as [
      [RetainedIdentityUpsertArgs],
    ];
    expect(retainedUpsertArgs.create.metadata?.schemaVersion).toBe(1);
    expect(retainedUpsertArgs.create.metadata?.request?.requestedBy).toBe('USER');
    expect(retainedUpsertArgs.update.metadata?.schemaVersion).toBe(1);

    const [[archiveCreateManyArgs]] = tx.archiveJob.createMany.mock.calls as [
      [ArchiveJobCreateManyArgs],
    ];
    expect(archiveCreateManyArgs.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'NICKNAME_AUDIT', userId: 'user-1' }),
        expect.objectContaining({ target: 'ACADEMIC_IDENTITY_AUDIT', userId: 'user-1' }),
      ]),
    );
    expect(tx.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: NOW },
    });

    const [[auditCreateArgs]] = tx.userDisplayIdentityNicknameChangeEvent.create.mock.calls as [
      [DisplayAuditCreateArgs],
    ];
    expect(auditCreateArgs.data.source).toBe('ACCOUNT_DELETION_DEIDENTIFICATION');
    expect(auditCreateArgs.data.nextNickname).toBe('탈퇴한 사용자');
    expect(auditCreateArgs.data.nextNicknameNormalized).toBe('deleted-anon-key');
    expect(auditCreateArgs.data.metadata?.priority).toBe(
      'ACCOUNT_DELETION_TOMBSTONE_OVERRIDES_DISPLAY_IDENTITY',
    );
    expect(tx.userDisplayIdentity.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        nickname: '탈퇴한 사용자',
        nicknameNormalized: 'deleted-anon-key',
        nicknameChangedAt: NOW,
      },
    });
    expect(tx.userAcademicIdentity.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(tx.userAcademicIdentityChangeAllowance.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });

    const [[profileUpdateArgs]] = tx.seasonParticipantProfile.updateMany.mock.calls as [
      [SeasonParticipantProfileUpdateArgs],
    ];
    expect(profileUpdateArgs.where).toEqual({ participant: { userId: 'user-1' } });
    expect(profileUpdateArgs.data).toEqual(
      expect.objectContaining({
        nicknameSnapshot: '탈퇴한 사용자',
        nicknameNormalizedSnapshot: 'deleted-anon-key',
        intro: '',
      }),
    );
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        email: 'deleted+anon-key@deleted.local',
        emailNormalized: 'deleted+anon-key@deleted.local',
        passwordHash: 'deleted:anon-key',
        emailVerifiedAt: null,
        deletedAt: NOW,
      },
    });
  });
});
