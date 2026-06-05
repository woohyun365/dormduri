import { CurrentSeasonParticipantContextResolver } from './current-season-participant-context.resolver.js';

describe('CurrentSeasonParticipantContextResolver', () => {
  const databaseNow = new Date('2026-06-03T01:02:03.000Z');
  const user = {
    id: 'user-1',
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
  };
  const requirement = {
    kind: 'current-season-participant',
    mode: 'ensure',
    source: 'actor-campus',
    failure: 'context-required',
  } as const;
  const prisma = {
    user: {
      findUnique: jest.fn(),
    },
    getDatabaseNow: jest.fn(),
  };
  const seasonParticipantsService = {
    ensureCurrentSeasonParticipant: jest.fn(),
  };
  const resolver = new CurrentSeasonParticipantContextResolver(
    prisma as never,
    seasonParticipantsService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.getDatabaseNow.mockResolvedValue(databaseNow);
    seasonParticipantsService.ensureCurrentSeasonParticipant.mockResolvedValue({
      id: 'participant-1',
    });
  });

  it('actor user를 DB now 기준 current season participant ensure input으로 변환한다', async () => {
    await expect(
      resolver.resolveForActor({
        actorUserId: 'user-1',
        requirement,
      }),
    ).resolves.toEqual({ id: 'participant-1' });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        emailVerifiedAt: true,
        deletedAt: true,
        gender: true,
        campus: true,
      },
    });
    expect(prisma.getDatabaseNow).toHaveBeenCalledTimes(1);
    expect(seasonParticipantsService.ensureCurrentSeasonParticipant).toHaveBeenCalledWith(
      user,
      databaseNow,
    );
  });

  it.each([
    ['missing user', null],
    ['unverified user', { ...user, emailVerifiedAt: null }],
    ['deleted user', { ...user, deletedAt: new Date('2026-01-02T00:00:00.000Z') }],
  ])(
    '%s는 기존 season action service error code로 fail-closed 처리한다',
    async (_label, dbUser) => {
      prisma.user.findUnique.mockResolvedValue(dbUser);

      await expect(
        resolver.resolveForActor({
          actorUserId: 'user-1',
          requirement,
        }),
      ).rejects.toMatchObject({
        response: { code: 'SEASON_PARTICIPATION_REGISTRATION_NOT_ALLOWED' },
      });

      expect(prisma.getDatabaseNow).not.toHaveBeenCalled();
      expect(seasonParticipantsService.ensureCurrentSeasonParticipant).not.toHaveBeenCalled();
    },
  );
});
