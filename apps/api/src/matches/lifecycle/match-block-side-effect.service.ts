import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type {
  MatchBlockSideEffectInput,
  MatchBlockSideEffectPort,
  MatchBlockSideEffectResult,
} from '../application/ports/match-block-side-effect.port.js';

@Injectable()
export class MatchBlockSideEffectService implements MatchBlockSideEffectPort {
  async cancelPendingRequestsForBlock(
    tx: Prisma.TransactionClient,
    input: MatchBlockSideEffectInput,
  ): Promise<MatchBlockSideEffectResult> {
    const participants = await tx.seasonParticipant.findMany({
      where: {
        seasonId: input.seasonId,
        userId: { in: [input.blockerUserId, input.blockedUserId] },
      },
      select: { id: true, userId: true },
    });
    const blockerParticipant = participants.find(
      (participant) => participant.userId === input.blockerUserId,
    );
    const blockedParticipant = participants.find(
      (participant) => participant.userId === input.blockedUserId,
    );
    if (!blockerParticipant || !blockedParticipant) {
      return { canceledRequestIds: [] };
    }

    const pairParticipantIds = [blockerParticipant.id, blockedParticipant.id];
    const pendingRequests = await tx.matchRequest.findMany({
      where: {
        seasonId: input.seasonId,
        status: 'PENDING',
        requesterParticipantId: { in: pairParticipantIds },
        receiverParticipantId: { in: pairParticipantIds },
      },
      select: { id: true },
    });
    const canceledRequestIds = pendingRequests.map((request) => request.id);
    if (canceledRequestIds.length === 0) {
      return { canceledRequestIds: [] };
    }

    await tx.matchRequest.updateMany({
      where: {
        id: { in: canceledRequestIds },
        status: 'PENDING',
      },
      data: {
        status: 'CANCELLED_BY_SYSTEM',
        terminalReason: 'MATCH_PRECONDITION_FAILED',
        terminalAt: input.occurredAt,
      },
    });

    return { canceledRequestIds };
  }
}
