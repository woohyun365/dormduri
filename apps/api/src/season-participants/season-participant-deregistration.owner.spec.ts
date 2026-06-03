import {
  createSeasonParticipantsServiceTestKit,
  now,
  participant,
  profile,
} from './season-participants.owner.spec-fixtures.js';
import { seasonParticipantsErrors } from './season-participants.errors.js';

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

  it('current season이 없으면 service path에서 deregistration-specific error를 유지한다', async () => {
    const { service, seasonsService, prisma } = createSeasonParticipantsServiceTestKit();
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);

    await expect(service.deregisterCurrentSeasonParticipation('user-1', now)).rejects.toMatchObject(
      {
        response: seasonParticipantsErrors.deregistrationNotAllowed().getResponse(),
      },
    );

    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('registered participant가 아니면 service path에서 deregistration-specific error를 유지한다', async () => {
    const { service, prisma } = createSeasonParticipantsServiceTestKit();
    prisma.seasonParticipant.findUnique.mockResolvedValue(
      participant({
        participationIntent: 'UNDECIDED',
        registeredAt: null,
        participantStatus: 'DRAFT',
        profile: profile(),
      }),
    );

    await expect(service.deregisterCurrentSeasonParticipation('user-1', now)).rejects.toMatchObject(
      {
        response: seasonParticipantsErrors.deregistrationNotAllowed().getResponse(),
      },
    );

    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
  });

  it('live ActiveMatch가 있으면 side effect 없이 deregistration-specific error를 유지한다', async () => {
    const { service, prisma, chatThreadWithdrawal } = createSeasonParticipantsServiceTestKit();
    prisma.seasonParticipant.findUnique.mockResolvedValue(
      participant({
        participationIntent: 'REGISTERED',
        registeredAt: now,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        profile: profile(),
      }),
    );
    prisma.activeMatch.findFirst.mockResolvedValue({ id: 'active-1' });

    await expect(service.deregisterCurrentSeasonParticipation('user-1', now)).rejects.toMatchObject(
      {
        response: seasonParticipantsErrors.deregistrationNotAllowed().getResponse(),
      },
    );

    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
    expect(
      chatThreadWithdrawal.markOpenDirectThreadsReadOnlyForWithdrawnParticipant,
    ).not.toHaveBeenCalled();
  });
});
