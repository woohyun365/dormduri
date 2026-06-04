import { updateCurrentUserRequestSchema } from '@repo/shared/user-contract';
import { validateSeasonProfileCompleteness } from '../profile-draft/season-profile-completeness.policy.js';
import { createSeasonParticipantSourceOwner } from '../participants/season-participant-source.policy.js';
import { SeasonParticipantsService } from './season-participants.service.js';
import { currentProfile, participant } from '../season-participants.owner.spec-fixtures.js';

describe('SeasonParticipantsService facade', () => {
  const writeOwner = {
    ensureCurrentSeasonParticipant: jest.fn(),
    createOrUpdateDormitorySelection: jest.fn(),
    backfillCurrentSeasonParticipants: jest.fn(),
    validateSeasonProfileCompleteness: jest.fn(),
  };
  const publicTargetOwner = {
    hasRegistrationSnapshotForParticipant: jest.fn(),
    findRegistrationSnapshotParticipantIdSet: jest.fn(),
  };
  const service = new SeasonParticipantsService(
    writeOwner as never,
    publicTargetOwner as never,
    createSeasonParticipantSourceOwner(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    writeOwner.validateSeasonProfileCompleteness.mockImplementation(
      validateSeasonProfileCompleteness,
    );
  });

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

  it('write use-case는 service 내부 factory 조립 없이 주입된 provider로 위임한다', async () => {
    const user = {
      id: 'user-1',
      emailVerifiedAt: new Date('2026-02-10T00:00:00.000Z'),
      campus: 'CHUNCHEON',
      gender: 'M',
    };
    const now = new Date('2026-02-10T03:00:00.000Z');
    const ensureResponse = participant({ userId: user.id });
    writeOwner.ensureCurrentSeasonParticipant.mockResolvedValue(ensureResponse);
    writeOwner.createOrUpdateDormitorySelection.mockResolvedValue({
      selection: { dormitoryId: 'dasan' },
    });
    writeOwner.backfillCurrentSeasonParticipants.mockResolvedValue([{ campus: 'CHUNCHEON' }]);

    await expect(service.ensureCurrentSeasonParticipant(user as never, now)).resolves.toBe(
      ensureResponse,
    );
    await expect(
      service.createOrUpdateDormitorySelection(user.id, { dormitoryId: 'dasan' }, now),
    ).resolves.toEqual({
      selection: { dormitoryId: 'dasan' },
    });
    await expect(service.backfillCurrentSeasonParticipants(now)).resolves.toEqual([
      { campus: 'CHUNCHEON' },
    ]);

    expect(writeOwner.ensureCurrentSeasonParticipant).toHaveBeenCalledWith(user, now, undefined);
    expect(writeOwner.createOrUpdateDormitorySelection).toHaveBeenCalledWith(
      user.id,
      { dormitoryId: 'dasan' },
      now,
    );
    expect(writeOwner.backfillCurrentSeasonParticipants).toHaveBeenCalledWith(now);
  });

  it('registration snapshot read는 주입된 public target provider로 위임한다', async () => {
    const tx = { seasonParticipantProfileHistory: {} };
    const idSet = new Set(['participant-1']);
    publicTargetOwner.hasRegistrationSnapshotForParticipant.mockResolvedValue(true);
    publicTargetOwner.findRegistrationSnapshotParticipantIdSet.mockResolvedValue(idSet);

    await expect(
      service.hasRegistrationSnapshotForParticipant('participant-1', tx as never),
    ).resolves.toBe(true);
    await expect(
      service.findRegistrationSnapshotParticipantIdSet(['participant-1'], tx as never),
    ).resolves.toBe(idSet);

    expect(publicTargetOwner.hasRegistrationSnapshotForParticipant).toHaveBeenCalledWith(
      'participant-1',
      tx,
    );
    expect(publicTargetOwner.findRegistrationSnapshotParticipantIdSet).toHaveBeenCalledWith(
      ['participant-1'],
      tx,
    );
  });

  it('PATCH /api/users/me에는 selection write path가 없다', () => {
    expect(
      updateCurrentUserRequestSchema.safeParse({ selection: { dormitoryId: 'dasan' } }).success,
    ).toBe(false);
  });
});
