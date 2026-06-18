import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type {
  MatchParticipantWithdrawalInput,
  MatchParticipantWithdrawalPort,
  MatchParticipantWithdrawalResult,
} from '../application/ports/match-participant-withdrawal.port.js';

@Injectable()
export class MatchParticipantWithdrawalService implements MatchParticipantWithdrawalPort {
  async cancelPendingRequestsForWithdrawnParticipant(
    tx: Prisma.TransactionClient,
    input: MatchParticipantWithdrawalInput,
  ): Promise<MatchParticipantWithdrawalResult> {
    const result = await tx.matchRequest.updateMany({
      where: {
        seasonId: input.seasonId,
        status: 'PENDING',
        OR: [
          { requesterParticipantId: input.participantId },
          { receiverParticipantId: input.participantId },
        ],
      },
      data: {
        status: 'CANCELLED_BY_SYSTEM',
        terminalReason: 'WITHDRAWN_PARTICIPANT',
        terminalAt: input.now,
      },
    });

    return { canceledPendingMatchRequests: result.count };
  }
}
