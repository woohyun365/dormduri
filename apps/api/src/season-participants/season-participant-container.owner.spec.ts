import {
  createSeasonParticipantsServiceTestKit,
  now,
  objectContaining,
} from './season-participants.owner.spec-fixtures.js';

describe('season-participant-container.owner', () => {
  it('ensureCurrentSeasonParticipant()는 row/container만 보장하고 registered/assigned/history를 만들지 않는다', async () => {
    const { service, prisma, txSeasonParticipantUpdate, txSeasonParticipantProfileHistoryCreate } =
      createSeasonParticipantsServiceTestKit();

    const result = await service.ensureCurrentSeasonParticipant(
      { id: 'user-1', emailVerifiedAt: now, gender: 'M', campus: 'CHUNCHEON' },
      now,
    );

    expect(prisma.seasonParticipant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: objectContaining({
          participationIntent: 'UNDECIDED',
          dormitorySelectionState: 'NOT_SELECTED',
          dormitoryId: null,
          participantStatus: 'NOT_STARTED',
        }),
        update: {},
      }),
    );
    expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
    expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();
    expect(result?.participationIntent).toBe('UNDECIDED');
  });
});
