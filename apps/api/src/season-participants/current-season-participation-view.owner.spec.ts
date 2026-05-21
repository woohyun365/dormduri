import { CurrentSeasonParticipationViewOwner } from './current-season-participation-view.owner.js';
import {
  now,
  participant,
  profile,
  seasonContext,
} from './season-participants.owner.spec-fixtures.js';

describe('current-season-participation-view.owner', () => {
  const prisma = {
    seasonParticipant: { findUnique: jest.fn() },
  };
  const seasonParticipantsService = {
    validateSeasonProfileCompleteness: jest.fn(),
    hasSelectableDormitoriesForCurrentParticipant: jest.fn(),
    hasSelectableDormitoriesForCurrentUser: jest.fn(),
    hasValidDormitorySelectionForCurrentParticipant: jest.fn(),
  };
  const owner = new CurrentSeasonParticipationViewOwner(
    prisma as never,
    seasonParticipantsService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    seasonParticipantsService.validateSeasonProfileCompleteness.mockReturnValue({ complete: true });
    seasonParticipantsService.hasSelectableDormitoriesForCurrentParticipant.mockResolvedValue(true);
    seasonParticipantsService.hasSelectableDormitoriesForCurrentUser.mockResolvedValue(true);
    seasonParticipantsService.hasValidDormitorySelectionForCurrentParticipant.mockResolvedValue(
      false,
    );
  });

  it('participant row가 없어도 사용자 snapshot 기준 selectable dormitory가 있으면 selection capability는 열린다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(null);
    seasonParticipantsService.validateSeasonProfileCompleteness.mockReturnValue({
      complete: false,
    });

    const result = await owner.buildCurrentUserSeasonParticipationSegment({
      user: {
        id: 'user-1',
        emailVerifiedAt: now,
        gender: 'M',
        campus: 'CHUNCHEON',
        deletedAt: null,
      },
      campusOperated: true,
      seasonState: 'SEASON_OPEN',
      seasonContext: seasonContext() as never,
      now,
    });

    expect(
      seasonParticipantsService.hasSelectableDormitoriesForCurrentParticipant,
    ).not.toHaveBeenCalled();
    expect(seasonParticipantsService.hasSelectableDormitoriesForCurrentUser).toHaveBeenCalledWith(
      {
        id: 'user-1',
        emailVerifiedAt: now,
        gender: 'M',
        campus: 'CHUNCHEON',
      },
      expect.objectContaining({ season: { id: 'season-1' } }),
      now,
    );
    expect(result.seasonProfile).toMatchObject({
      hasParticipantRow: false,
      profileState: 'NONE',
      canSelectDormitory: true,
      canFinalizeRegistration: false,
    });
    expect(result.capabilities).toMatchObject({
      canSelectDormitory: true,
      canFinalizeSeasonRegistration: false,
    });
  });

  it('SELECTED dormitory가 유효하면 registration finalize capability를 연다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(
      participant({
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        profile: profile(),
      }),
    );
    seasonParticipantsService.hasValidDormitorySelectionForCurrentParticipant.mockResolvedValue(
      true,
    );

    const result = await owner.buildCurrentUserSeasonParticipationSegment({
      user: {
        id: 'user-1',
        emailVerifiedAt: now,
        gender: 'M',
        campus: 'CHUNCHEON',
        deletedAt: null,
      },
      campusOperated: true,
      seasonState: 'SEASON_OPEN',
      seasonContext: seasonContext() as never,
      now,
    });

    expect(result.selection).toMatchObject({ state: 'SELECTED', dormitoryId: 'dasan' });
    expect(result.seasonProfile).toMatchObject({
      profileState: 'COMPLETE',
      canSelectDormitory: true,
      canFinalizeRegistration: true,
    });
    expect(result.capabilities.canFinalizeSeasonRegistration).toBe(true);
  });

  it('REGISTERED+ASSIGNED는 finalized state이고 draft/selection/finalize capability를 닫는다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(
      participant({
        participationIntent: 'REGISTERED',
        registeredAt: now,
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        participantStatus: 'ACTIVE',
        profile: profile(),
      }),
    );

    const result = await owner.buildCurrentUserSeasonParticipationSegment({
      user: {
        id: 'user-1',
        emailVerifiedAt: now,
        gender: 'M',
        campus: 'CHUNCHEON',
        deletedAt: null,
      },
      campusOperated: true,
      seasonState: 'SEASON_OPEN',
      seasonContext: seasonContext() as never,
      now,
    });

    expect(result.seasonProfile.registered).toBe(true);
    expect(result.seasonProfile.profileState).toBe('REGISTRATION_FINALIZED');
    expect(result.seasonProfile.draftWritable).toBe(false);
    expect(result.capabilities).toMatchObject({
      canCreateOrUpdateSeasonProfileDraft: false,
      canSelectDormitory: false,
      canFinalizeSeasonRegistration: false,
    });
  });
});
