import { CurrentSeasonParticipationViewQuery } from './current-season-participation-view.query.js';
import {
  now,
  participant,
  profile,
  seasonContext,
} from '../test-support/season-participants.spec-fixtures.js';

describe('current-season-participation-view.query', () => {
  const prisma = {
    seasonParticipant: { findUnique: jest.fn() },
  };
  const seasonParticipantsService = {
    validateSeasonProfileCompleteness: jest.fn(),
    hasSelectableDormitoriesForCurrentParticipant: jest.fn(),
    hasSelectableDormitoriesForCurrentUser: jest.fn(),
    hasValidDormitorySelectionForCurrentParticipant: jest.fn(),
  };
  const owner = new CurrentSeasonParticipationViewQuery(
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

  it('SELECTED dormitory가 stale/invalid이면 current-user는 등록 완료 capability를 열지 않는다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(
      participant({
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        profile: profile(),
      }),
    );
    seasonParticipantsService.hasSelectableDormitoriesForCurrentParticipant.mockResolvedValue(
      false,
    );
    seasonParticipantsService.hasValidDormitorySelectionForCurrentParticipant.mockResolvedValue(
      false,
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
      seasonState: 'SEASON_MATCHING',
      seasonContext: seasonContext({ state: 'SEASON_MATCHING' }) as never,
      now,
    });

    expect(result.selection).toMatchObject({ state: 'SELECTED', dormitoryId: 'dasan' });
    expect(result.seasonProfile).toMatchObject({
      registered: false,
      profileState: 'COMPLETE',
      canSelectDormitory: false,
      canFinalizeRegistration: false,
    });
    expect(result.seasonProfile.completion.registrationUnavailableReasons).toEqual(
      expect.arrayContaining(['DORMITORY_SELECTION_REQUIRED', 'NO_SELECTABLE_DORMITORY']),
    );
    expect(result.capabilities.canFinalizeSeasonRegistration).toBe(false);
  });

  it('account 또는 participant inactive 상태면 current-user registration capability를 닫는다', async () => {
    prisma.seasonParticipant.findUnique.mockResolvedValue(
      participant({
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        hiddenByAdminAt: now,
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
        deletedAt: now,
      },
      campusOperated: true,
      seasonState: 'SEASON_OPEN',
      seasonContext: seasonContext() as never,
      now,
    });

    expect(result.seasonProfile.completion.registrationUnavailableReasons).toContain(
      'ACCOUNT_OR_PARTICIPANT_INACTIVE',
    );
    expect(result.capabilities).toMatchObject({
      canCreateOrUpdateSeasonProfileDraft: false,
      canSelectDormitory: false,
      canFinalizeSeasonRegistration: false,
    });
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
