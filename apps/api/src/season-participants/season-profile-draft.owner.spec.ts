import { seasonParticipantsErrors } from './errors/season-participants.errors.js';
import {
  createSeasonParticipantsServiceTestKit,
  draftInput,
  now,
  objectContaining,
  participant,
  profile,
  seasonContext,
} from './season-participants.owner.spec-fixtures.js';

describe('season-profile-draft.owner', () => {
  it('createOrUpdateSeasonProfileDraft()는 draft current row만 쓰고 history를 만들지 않는다', async () => {
    const {
      service,
      txSeasonParticipantProfileUpsert,
      txSeasonParticipantUpdate,
      txSeasonParticipantProfileHistoryCreate,
    } = createSeasonParticipantsServiceTestKit();

    const response = await service.createOrUpdateSeasonProfileDraft('user-1', draftInput, now);

    expect(txSeasonParticipantProfileUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { participantId: 'participant-1' },
        create: objectContaining({
          participantId: 'participant-1',
          nicknameSnapshot: '현재닉네임',
          intro: '시즌 소개',
          grade: '3',
          mbti: 'INTJ',
        }),
        update: objectContaining({
          nicknameSnapshot: '현재닉네임',
          intro: '시즌 소개',
          grade: '3',
          mbti: 'INTJ',
        }),
      }),
    );
    expect(txSeasonParticipantUpdate).toHaveBeenCalledWith({
      where: { id: 'participant-1' },
      data: { participantStatus: 'DRAFT' },
    });
    expect(txSeasonParticipantProfileHistoryCreate).not.toHaveBeenCalled();
    expect(response.state).toBe('COMPLETE');
  });

  it('getCurrentSeasonProfile()은 participant row를 생성하지 않고 빈 draft state를 반환한다', async () => {
    const { service, prisma } = createSeasonParticipantsServiceTestKit();
    prisma.seasonParticipant.findUnique.mockResolvedValueOnce(null);

    const response = await service.getCurrentSeasonProfile('user-1', now);

    expect(prisma.seasonParticipant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          seasonId_userId: {
            seasonId: 'season-1',
            userId: 'user-1',
          },
        },
      }),
    );
    expect(prisma.seasonParticipant.upsert).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      participantId: null,
      seasonId: 'season-1',
      state: 'NONE',
      draftWritable: true,
    });
    expect(response.completion.registrationUnavailableReasons).toEqual(
      expect.arrayContaining(['PROFILE_INCOMPLETE', 'DORMITORY_SELECTION_REQUIRED']),
    );
  });

  it('getCurrentSeasonProfile()은 SEASON_POST_MATCH에서도 read-only로 조회하고 draft write는 닫는다', async () => {
    const { service, prisma, seasonsService } = createSeasonParticipantsServiceTestKit();
    seasonsService.getCurrentSeasonContext.mockResolvedValueOnce(
      seasonContext({ state: 'SEASON_POST_MATCH' }),
    );
    prisma.seasonParticipant.findUnique.mockResolvedValueOnce(participant({ profile: profile() }));

    const response = await service.getCurrentSeasonProfile('user-1', now);

    expect(prisma.seasonParticipant.upsert).not.toHaveBeenCalled();
    expect(response).toMatchObject({
      participantId: 'participant-1',
      seasonId: 'season-1',
      state: 'COMPLETE',
      draftWritable: false,
    });
    expect(response.completion.registrationUnavailableReasons).toContain('SEASON_NOT_OPEN');
  });

  it('registration 후 profile draft 수정은 거부한다', async () => {
    const { service, txSeasonParticipantUpsert, txSeasonParticipantProfileUpsert } =
      createSeasonParticipantsServiceTestKit();
    txSeasonParticipantUpsert.mockResolvedValue(
      participant({
        participationIntent: 'REGISTERED',
        registeredAt: now,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        profile: profile(),
      }),
    );

    await expect(
      service.createOrUpdateSeasonProfileDraft('user-1', draftInput, now),
    ).rejects.toMatchObject({
      response: seasonParticipantsErrors.seasonProfileDraftNotAllowed().getResponse(),
    });
    expect(txSeasonParticipantProfileUpsert).not.toHaveBeenCalled();
  });
});
