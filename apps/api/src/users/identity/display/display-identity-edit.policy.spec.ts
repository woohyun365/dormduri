import {
  buildDisplayIdentityEditUnavailableReasons,
  isNicknameLockedByCurrentSeasonRegistration,
  resolveNicknameChangePolicy,
} from './display-identity-edit.policy.js';

const NOW = new Date('2026-05-21T00:00:00.000Z');

function currentParticipant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'participant-1',
    seasonId: 'season-1',
    userId: 'user-1',
    participationIntent: 'REGISTERED',
    registeredAt: new Date('2026-05-10T00:00:00.000Z'),
    declinedAt: null,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
    participantStatus: 'ACTIVE',
    campusCodeSnapshot: 'CHUNCHEON',
    genderSnapshot: 'M',
    joinedAt: new Date('2026-05-01T00:00:00.000Z'),
    activatedAt: new Date('2026-05-01T00:00:00.000Z'),
    matchedAt: null,
    withdrawnAt: null,
    expiredAt: null,
    hiddenByAdminAt: null,
    hiddenReasonCode: null,
    hiddenReasonDetail: null,
    deactivatedAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    profile: null,
    ...overrides,
  };
}

describe('display identity edit policy', () => {
  it('registered participant와 open/matching/post-match season에서 nickname을 잠근다', () => {
    expect(
      isNicknameLockedByCurrentSeasonRegistration({
        seasonState: 'SEASON_OPEN',
        participantRegistered: true,
      }),
    ).toBe(true);
    expect(
      isNicknameLockedByCurrentSeasonRegistration({
        seasonState: 'SEASON_MATCHING',
        participantRegistered: true,
      }),
    ).toBe(true);
    expect(
      isNicknameLockedByCurrentSeasonRegistration({
        seasonState: 'SEASON_POST_MATCH',
        participantRegistered: true,
      }),
    ).toBe(true);
  });

  it('registration lock과 cooldown reason을 current-user capability reason으로 조합한다', () => {
    expect(
      buildDisplayIdentityEditUnavailableReasons({
        nicknameLockedBySeason: true,
        nicknameCooldownActive: true,
      }),
    ).toEqual(['CURRENT_SEASON_REGISTRATION_LOCK', 'NICKNAME_COOLDOWN_ACTIVE']);
  });

  it('current season이 없으면 participant query 없이 nickname lock을 비활성화한다', async () => {
    const seasonsService = { getCurrentSeasonContext: jest.fn().mockResolvedValue(null) };
    const client = { seasonParticipant: { findUnique: jest.fn() } };

    await expect(
      resolveNicknameChangePolicy(
        { prisma: client as never, seasonsService: seasonsService as never },
        { id: 'user-1', campus: 'CHUNCHEON' },
        NOW,
        client as never,
      ),
    ).resolves.toEqual({ nicknameLockedBySeason: false, currentRegisteredParticipant: null });

    expect(client.seasonParticipant.findUnique).not.toHaveBeenCalled();
  });

  it('current season registered participant는 nickname lock과 registered participant context를 반환한다', async () => {
    const seasonsService = {
      getCurrentSeasonContext: jest.fn().mockResolvedValue({
        season: { id: 'season-1' },
        state: 'SEASON_OPEN',
      }),
    };
    const client = {
      seasonParticipant: { findUnique: jest.fn().mockResolvedValue(currentParticipant()) },
    };

    const result = await resolveNicknameChangePolicy(
      { prisma: client as never, seasonsService: seasonsService as never },
      { id: 'user-1', campus: 'CHUNCHEON' },
      NOW,
      client as never,
    );

    expect(client.seasonParticipant.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { seasonId_userId: { seasonId: 'season-1', userId: 'user-1' } },
      }),
    );
    expect(result).toMatchObject({
      nicknameLockedBySeason: true,
      currentRegisteredParticipant: { id: 'participant-1', seasonId: 'season-1' },
    });
  });
});
