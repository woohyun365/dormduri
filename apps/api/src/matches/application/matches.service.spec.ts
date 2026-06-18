import { beforeEach, describe, expect, it } from 'vitest';
import {
  createMatchesServiceSpecHarness,
  makeParticipant,
  makeUserSeed,
} from '../test-support/matches-service-spec.harness.js';

describe('MatchesService facade', () => {
  const harness = createMatchesServiceSpecHarness();
  const { service, seasonsService, prisma, seasonParticipantsService } = harness;

  beforeEach(() => {
    harness.reset();
  });

  it('roomSelectionDate 이후에도 ACTIVE 결과는 seasonEndDate 전까지 조회된다', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(makeUserSeed());
    seasonsService.getCurrentSeasonContext.mockResolvedValueOnce({
      season: { id: 'season-1' },
      state: 'SEASON_POST_MATCH',
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
      ],
      schedule: {
        preparationStart: '2026-02-01',
        matchingStart: '2026-02-05',
        matchingEnd: '2026-02-11',
        seasonEnd: '2026-02-28',
      },
    });
    seasonParticipantsService.ensureCurrentSeasonParticipant.mockResolvedValueOnce(
      makeParticipant({
        participantStatus: 'MATCHED',
        matchedAt: new Date('2026-02-10T03:00:00.000Z'),
      }),
    );
    prisma.activeMatch.findFirst.mockResolvedValueOnce({
      id: 'active-1',
      seasonId: 'season-1',
      participantAId: 'participant-1',
      participantBId: 'participant-2',
      status: 'ACTIVE',
      startedAt: new Date('2026-02-10T03:00:00.000Z'),
      endedAt: null,
      endReason: null,
      createdFromRequestId: 'request-1',
      participantA: {
        userId: 'user-1',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      participantB: {
        userId: 'user-2',
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      unmatchRequests: [],
    });

    const result = await service.getCurrentActiveMatch({
      id: 'user-1',
      gender: 'M',
      campus: 'CHUNCHEON',
    });

    expect(result.activeMatch).toMatchObject({
      id: 'active-1',
      counterpartUserId: 'user-2',
      status: 'ACTIVE',
      unmatchProgress: {
        state: 'NONE',
        progressCount: 0,
        canRequest: false,
      },
    });
  });
});
