import { describe, expect, it } from 'vitest';
import {
  createSeasonParticipantsServiceTestKit,
  now,
  objectContaining,
  participant,
  profile,
  seasonContext,
} from '../test-support/season-participants.spec-fixtures.js';
import { seasonParticipantsErrors } from '../errors/season-participants.errors.js';

describe('deregister-season-participant.command', () => {
  it('withdrawal에 따른 chat thread lifecycle mutation은 chat withdrawal port로 위임한다', async () => {
    const {
      service,
      prisma,
      tx,
      txSeasonParticipantUpdate,
      txSeasonParticipantLifecycleEventCreate,
      chatThreadWithdrawal,
      matchParticipantWithdrawal,
    } = createSeasonParticipantsServiceTestKit();
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
    matchParticipantWithdrawal.cancelPendingRequestsForWithdrawnParticipant.mockResolvedValueOnce({
      canceledPendingMatchRequests: 2,
    });
    chatThreadWithdrawal.markOpenDirectThreadsReadOnlyForWithdrawnParticipant.mockResolvedValueOnce(
      {
        updatedThreadIds: ['thread-1', 'thread-2', 'thread-3'],
      },
    );

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
      matchParticipantWithdrawal.cancelPendingRequestsForWithdrawnParticipant,
    ).toHaveBeenCalledWith(tx, {
      seasonId: 'season-1',
      participantId: 'participant-1',
      now,
    });
    expect(
      chatThreadWithdrawal.markOpenDirectThreadsReadOnlyForWithdrawnParticipant,
    ).toHaveBeenCalledWith(tx, {
      seasonId: 'season-1',
      participantId: 'participant-1',
      now,
    });
    expect(txSeasonParticipantLifecycleEventCreate).toHaveBeenCalledWith({
      data: objectContaining({
        participantId: 'participant-1',
        seasonId: 'season-1',
        userId: 'user-1',
        eventType: 'WITHDRAWN',
        actorUserId: 'user-1',
        actorType: 'USER',
        reason: 'USER_DEREGISTERED',
        occurredAt: now,
        metadata: objectContaining({
          transitionOwner: 'deregistration.command',
          previousStatus: 'ACTIVE',
          nextStatus: 'WITHDRAWN',
          previousIntent: 'REGISTERED',
          nextIntent: 'DECLINED',
          previousDormitoryId: 'dasan',
          nextDormitoryId: 'dasan',
          selectionState: 'ASSIGNED',
          canceledPendingMatchRequests: 2,
          chatThreadsMarkedReadOnly: 3,
        }),
      }),
      select: { id: true },
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

  it('POST_MATCH season이면 service path에서 deregistration-specific error를 유지한다', async () => {
    const { service, seasonsService, prisma } = createSeasonParticipantsServiceTestKit();
    seasonsService.getCurrentSeasonContext.mockResolvedValue(
      seasonContext({ state: 'SEASON_POST_MATCH' }),
    );

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

  it('tx 내부 active match race가 보이면 participant/match/chat side effect 없이 닫는다', async () => {
    const {
      service,
      prisma,
      tx,
      txSeasonParticipantUpdate,
      txSeasonParticipantLifecycleEventCreate,
      chatThreadWithdrawal,
      matchParticipantWithdrawal,
    } = createSeasonParticipantsServiceTestKit();
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
    prisma.activeMatch.findFirst.mockResolvedValue(null);
    tx.activeMatch.findFirst.mockResolvedValueOnce({ id: 'active-race' });

    await expect(service.deregisterCurrentSeasonParticipation('user-1', now)).rejects.toMatchObject(
      {
        response: seasonParticipantsErrors.deregistrationNotAllowed().getResponse(),
      },
    );

    expect(txSeasonParticipantUpdate).not.toHaveBeenCalled();
    expect(
      matchParticipantWithdrawal.cancelPendingRequestsForWithdrawnParticipant,
    ).not.toHaveBeenCalled();
    expect(txSeasonParticipantLifecycleEventCreate).not.toHaveBeenCalled();
    expect(
      chatThreadWithdrawal.markOpenDirectThreadsReadOnlyForWithdrawnParticipant,
    ).not.toHaveBeenCalled();
  });
});
