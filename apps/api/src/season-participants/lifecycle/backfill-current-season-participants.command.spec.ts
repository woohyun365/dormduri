import { describe, expect, it } from 'vitest';
import {
  createSeasonParticipantsServiceTestKit,
  now,
  objectContaining,
  participant,
  user,
} from '../test-support/season-participants.spec-fixtures.js';

describe('backfill-current-season-participants.command', () => {
  it('backfill로 생성한 participant는 같은 transaction에서 JOINED lifecycle event를 append한다', async () => {
    const {
      service,
      prisma,
      txSeasonParticipantCreateManyAndReturn,
      txSeasonParticipantLifecycleEventCreateMany,
    } = createSeasonParticipantsServiceTestKit();
    prisma.campusMaster.findMany.mockResolvedValue([{ code: 'CHUNCHEON' }]);
    prisma.user.findMany.mockResolvedValue([
      user({
        id: 'user-new',
        displayIdentity: undefined,
        academicIdentity: undefined,
      }),
    ]);
    prisma.seasonParticipant.findMany.mockResolvedValue([]);
    txSeasonParticipantCreateManyAndReturn.mockResolvedValue([
      participant({
        id: 'participant-new',
        userId: 'user-new',
        seasonId: 'season-1',
        joinedAt: now,
        profile: null,
      }),
    ]);
    txSeasonParticipantLifecycleEventCreateMany.mockResolvedValue({ count: 1 });

    await expect(service.backfillCurrentSeasonParticipants(now)).resolves.toEqual([
      {
        campus: 'CHUNCHEON',
        seasonId: 'season-1',
        eligibleUserCount: 1,
        createdCount: 1,
        existingCount: 0,
      },
    ]);

    expect(txSeasonParticipantCreateManyAndReturn).toHaveBeenCalledWith(
      objectContaining({
        skipDuplicates: true,
        select: objectContaining({
          id: true,
          seasonId: true,
          userId: true,
          joinedAt: true,
        }),
      }),
    );
    expect(txSeasonParticipantLifecycleEventCreateMany).toHaveBeenCalledWith({
      data: [
        objectContaining({
          participantId: 'participant-new',
          seasonId: 'season-1',
          userId: 'user-new',
          eventType: 'JOINED',
          actorUserId: null,
          actorType: 'SYSTEM',
          reason: 'SEASON_PARTICIPANT_BACKFILLED',
          occurredAt: now,
          metadata: objectContaining({
            transitionOwner: 'backfill.current-season-participants',
            nextStatus: 'NOT_STARTED',
            nextIntent: 'UNDECIDED',
            nextDormitoryId: null,
            selectionState: 'NOT_SELECTED',
          }),
        }),
      ],
    });
  });
});
