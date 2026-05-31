import { updateCurrentUserRequestSchema } from '@repo/shared/user-contract';
import { SeasonParticipantsService } from './season-participants.service.js';
import { currentProfile, participant } from './season-participants.owner.spec-fixtures.js';

describe('SeasonParticipantsService facade', () => {
  const service = new SeasonParticipantsService({} as never, {} as never, {} as never);

  it('profile completeness pure helper를 facade로 유지한다', () => {
    expect(service.validateSeasonProfileCompleteness(currentProfile()).complete).toBe(true);
    expect(
      service.validateSeasonProfileCompleteness(
        currentProfile({ lifestyle: { ...currentProfile().lifestyle, drinkingTolerance: null } }),
      ).complete,
    ).toBe(false);
    expect(service.validateSeasonProfileCompleteness(null).complete).toBe(false);
  });

  it('canonical selection 계산을 source owner facade로 유지한다', () => {
    expect(
      service.selectCanonicalSelection(
        participant({ dormitorySelectionState: 'SELECTED', dormitoryId: 'dasan' }) as never,
      ),
    ).toEqual({
      dormitorySelectionState: 'SELECTED',
      dormitoryId: 'dasan',
      source: 'SEASON_PARTICIPANT',
    });

    expect(
      service.selectCanonicalSelection(
        participant({
          participationIntent: 'REGISTERED',
          registeredAt: new Date('2026-02-10T03:00:00.000Z'),
          dormitorySelectionState: 'ASSIGNED',
          dormitoryId: 'dasan',
        }) as never,
      ),
    ).toEqual({
      dormitorySelectionState: 'ASSIGNED',
      dormitoryId: 'dasan',
      source: 'SEASON_PARTICIPANT',
    });
  });

  it('PATCH /api/users/me에는 selection write path가 없다', () => {
    expect(
      updateCurrentUserRequestSchema.safeParse({ selection: { dormitoryId: 'dasan' } }).success,
    ).toBe(false);
  });
});
