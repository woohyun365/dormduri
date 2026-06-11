import type { Prisma } from '../../generated/prisma/client.js';
import { MatchParticipantWithdrawalService } from './match-participant-withdrawal.service.js';

describe('MatchParticipantWithdrawalService', () => {
  const now = new Date('2026-02-10T03:00:00.000Z');

  function createTx() {
    return {
      matchRequest: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
  }

  it('withdrawn participant가 포함된 pending match request를 matches-owned mutation으로 cancel한다', async () => {
    const service = new MatchParticipantWithdrawalService();
    const tx = createTx();

    await expect(
      service.cancelPendingRequestsForWithdrawnParticipant(
        tx as unknown as Prisma.TransactionClient,
        {
          seasonId: 'season-1',
          participantId: 'participant-1',
          now,
        },
      ),
    ).resolves.toEqual({ canceledPendingMatchRequests: 2 });

    expect(tx.matchRequest.updateMany).toHaveBeenCalledWith({
      where: {
        seasonId: 'season-1',
        status: 'PENDING',
        OR: [
          { requesterParticipantId: 'participant-1' },
          { receiverParticipantId: 'participant-1' },
        ],
      },
      data: {
        status: 'CANCELLED_BY_SYSTEM',
        terminalReason: 'WITHDRAWN_PARTICIPANT',
        terminalAt: now,
      },
    });
  });

  it('pending request가 없으면 count 0을 반환하고 추가 read를 만들지 않는다', async () => {
    const service = new MatchParticipantWithdrawalService();
    const tx = createTx();
    tx.matchRequest.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.cancelPendingRequestsForWithdrawnParticipant(
        tx as unknown as Prisma.TransactionClient,
        {
          seasonId: 'season-1',
          participantId: 'participant-1',
          now,
        },
      ),
    ).resolves.toEqual({ canceledPendingMatchRequests: 0 });

    expect(tx.matchRequest.updateMany).toHaveBeenCalledTimes(1);
  });
});
