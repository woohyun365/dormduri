import { describe, expect, it } from 'vitest';
import {
  createSeasonParticipantsServiceTestKit,
  now,
  objectContaining,
  participant,
  profile,
} from '../test-support/season-participants.spec-fixtures.js';

describe('get-previous-season-profile.query', () => {
  it('직전 종료 시즌의 registration profile history를 내 시즌 프로필 contract로 반환한다', async () => {
    const { service, prisma } = createSeasonParticipantsServiceTestKit();
    prisma.seasonParticipant.findFirst.mockResolvedValue(
      participant({
        id: 'participant-prev-1',
        seasonId: 'season-prev-1',
        participationIntent: 'REGISTERED',
        registeredAt: now,
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
        participantStatus: 'ACTIVE',
        profile: profile({ participantId: 'participant-prev-1' }),
        dormitory: { nameKo: '다산관' },
        season: {
          id: 'season-prev-1',
          name: '2026년 1학기',
          seasonEndDate: new Date('2026-03-01T00:00:00.000Z'),
          matchingStartDate: new Date('2026-02-01T00:00:00.000Z'),
          createdAt: now,
        },
      }),
    );
    prisma.seasonParticipantProfileHistory.findFirst.mockResolvedValue({
      ...profile({ participantId: 'participant-prev-1' }),
      id: 'profile-history-1',
      participantId: 'participant-prev-1',
      seasonId: 'season-prev-1',
      registeredAtSnapshot: now,
      createdAt: now,
    });

    const result = await service.getPreviousSeasonProfile('user-1', now);

    expect(prisma.seasonParticipant.findFirst).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          userId: 'user-1',
          registeredAt: { not: null },
          season: objectContaining({
            campusCode: 'CHUNCHEON',
            seasonEndDate: { lt: new Date('2026-02-10T00:00:00.000Z') },
          }),
        }),
      }),
    );
    expect(prisma.seasonParticipantProfileHistory.findFirst).toHaveBeenCalledWith(
      objectContaining({
        where: {
          participantId: 'participant-prev-1',
          seasonId: 'season-prev-1',
          redactedAt: null,
        },
      }),
    );
    expect(result).toMatchObject({
      detailState: 'FULL',
      seasonName: '2026년 1학기',
      dormitoryName: '다산관',
      state: 'REGISTRATION_FINALIZED',
      additional: { grade: '3', mbti: 'INTJ' },
      draftWritable: false,
    });
  });

  it('직전 시즌 참여 프로필이 없으면 EMPTY contract로 반환한다', async () => {
    const { service, prisma } = createSeasonParticipantsServiceTestKit();
    prisma.seasonParticipant.findFirst.mockResolvedValue(null);

    await expect(service.getPreviousSeasonProfile('user-1', now)).resolves.toMatchObject({
      detailState: 'EMPTY',
      reason: 'NO_PREVIOUS_SEASON_PROFILE',
    });
    expect(prisma.seasonParticipantProfileHistory.findFirst).not.toHaveBeenCalled();
  });
});
