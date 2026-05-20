import { InternalServerErrorException } from '@nestjs/common';
import { CurrentUserViewService } from './current-user-view.service.js';

describe('CurrentUserViewService identity invariant', () => {
  const prisma = {
    getDatabaseNow: jest.fn(),
    user: {
      findUnique: jest.fn(),
    },
    campusMaster: {
      findUnique: jest.fn(),
    },
    seasonParticipant: {
      findUnique: jest.fn(),
    },
  };
  const seasonsService = {
    getCurrentSeasonContext: jest.fn(),
  };
  const seasonParticipantsService = {};
  const matchesService = {
    getCurrentActiveMatchSummaryForParticipant: jest.fn(),
  };
  const service = new CurrentUserViewService(
    prisma as never,
    seasonsService as never,
    seasonParticipantsService as never,
    matchesService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(new Date('2026-05-21T00:00:00.000Z'));
  });

  it('current-user는 display identity 없이 정상 response를 만들지 않고 invariant error를 던진다', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-legacy',
      email: 'legacy@kangwon.ac.kr',
      emailVerifiedAt: new Date('2026-05-01T00:00:00.000Z'),
      gender: 'M',
      campus: 'CHUNCHEON',
      displayIdentity: null,
      dismissedNotices: [],
    });

    try {
      await service.getCurrentUser({
        id: 'user-legacy',
        gender: 'M',
        campus: 'CHUNCHEON',
      });
      throw new Error('Expected current-user invariant violation');
    } catch (error) {
      expect(error).toBeInstanceOf(InternalServerErrorException);
      const response = (error as InternalServerErrorException).getResponse();
      expect(response).toMatchObject({
        success: false,
        code: 'ACCOUNT_IDENTITY_INCOMPLETE',
        invariant: 'USER_DISPLAY_IDENTITY_REQUIRED',
        surface: 'current-user',
      });
    }

    expect(prisma.campusMaster.findUnique).not.toHaveBeenCalled();
    expect(prisma.seasonParticipant.findUnique).not.toHaveBeenCalled();
    expect(matchesService.getCurrentActiveMatchSummaryForParticipant).not.toHaveBeenCalled();
  });
});
