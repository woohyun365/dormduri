import {
  createSeasonParticipantsServiceTestKit,
  now,
  participant,
  profile,
} from './season-participants.owner.spec-fixtures.js';

describe('season-participant-deregistration.owner', () => {
  it('withdrawal에 따른 chat thread lifecycle mutation은 chat withdrawal port로 위임한다', async () => {
    const { service, prisma, tx, txSeasonParticipantUpdate, chatThreadWithdrawal } =
      createSeasonParticipantsServiceTestKit();
    const registeredParticipant = participant({
      participationIntent: 'REGISTERED',
      registeredAt: now,
      dormitoryId: 'dasan',
      dormitorySelectionState: 'ASSIGNED',
      participantStatus: 'ACTIVE',
      profile: profile(),
    });
    prisma.seasonParticipant.findUnique.mockResolvedValue(registeredParticipant);
    prisma.activeMatch.findFirst.mockResolvedValue(null);

    await service.deregisterCurrentSeasonParticipation('user-1', now);

    const [updateCall] = txSeasonParticipantUpdate.mock.calls[0] as [
      { where: { id: string }; data: Record<string, unknown> },
    ];
    expect(updateCall).toMatchObject({
      where: { id: 'participant-1' },
      data: {
        participationIntent: 'DECLINED',
        participantStatus: 'WITHDRAWN',
      },
    });
    expect(
      chatThreadWithdrawal.markOpenDirectThreadsReadOnlyForWithdrawnParticipant,
    ).toHaveBeenCalledWith(tx, {
      seasonId: 'season-1',
      participantId: 'participant-1',
      now,
    });
  });
});
