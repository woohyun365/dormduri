import { hashPassword } from '../auth/auth-password.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import type { SeasonsService } from '../seasons/seasons.service.js';
import { createUserDeletionOwner } from './user-deletion-owner.js';

describe('createUserDeletionOwner', () => {
  it('transaction 내부에서 current season registration 상태를 다시 확인해 deletion/finalize race를 fail-closed 한다', async () => {
    const now = new Date('2026-05-24T00:00:00.000Z');
    const passwordHash = await hashPassword('Pass1234');
    const seasonContext = {
      state: 'SEASON_MATCHING',
      season: { id: 'season-1' },
      schedule: { seasonEnd: '2026-06-30' },
    };
    const precheckParticipant = {
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
    };
    const txRegisteredParticipant = {
      ...precheckParticipant,
      participationIntent: 'REGISTERED',
      registeredAt: now,
      dormitorySelectionState: 'ASSIGNED',
      participantStatus: 'ACTIVE',
    };
    const txParticipantFindUnique = jest.fn().mockResolvedValue(txRegisteredParticipant);
    const retainedIdentityCreate = jest.fn();
    const precheckParticipantFindUnique = jest.fn().mockResolvedValue(precheckParticipant);
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          deletedAt: null,
        }),
      },
      seasonParticipant: {
        findUnique: txParticipantFindUnique,
      },
      retainedIdentity: {
        create: retainedIdentityCreate,
      },
    };
    const prisma = {
      getDatabaseNow: jest.fn().mockResolvedValue(now),
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          campus: 'CHUNCHEON',
          passwordHash,
          deletedAt: null,
        }),
      },
      seasonParticipant: {
        findUnique: precheckParticipantFindUnique,
      },
      runSerializableTransaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    } as unknown as PrismaService;
    const seasonsService = {
      getCurrentSeasonContext: jest.fn().mockResolvedValue(seasonContext),
    } as unknown as SeasonsService;

    const owner = createUserDeletionOwner({ prisma, seasonsService });

    await expect(
      owner.requestAccountDeletion('user-1', { password: 'Pass1234' }),
    ).rejects.toMatchObject({
      response: {
        code: 'ACCOUNT_DELETION_BLOCKED_BY_SEASON_PARTICIPATION',
      },
    });
    expect(precheckParticipantFindUnique).toHaveBeenCalledTimes(1);
    expect(txParticipantFindUnique).toHaveBeenCalledTimes(1);
    expect(retainedIdentityCreate).not.toHaveBeenCalled();
  });
});
