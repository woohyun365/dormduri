import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  CurrentSeasonParticipationController,
  CurrentSeasonProfileController,
} from './current-season-participation.controller.js';
import { seasonParticipantsErrors } from './errors/season-participants.errors.js';

function getBadRequestResponse(error: unknown) {
  expect(error).toBeInstanceOf(BadRequestException);
  if (!(error instanceof BadRequestException)) {
    throw new Error('Expected BadRequestException');
  }
  return error.getResponse() as { code?: string; details?: unknown };
}

function makeSeasonProfileDraftRequest() {
  return {
    lifestyle: {
      bedtime: 'BEFORE_22',
      wakeTime: 'BEFORE_07',
      sleepHabit: 'NONE',
      sleepEnvironment: 'QUIET',
      screenUsage: 'NONE',
      noiseSensitivity: 'NORMAL',
      smokingBehavior: 'NO',
      indoorEating: 'RARELY',
      phoneBehavior: 'RARELY',
      earphoneUsage: 'ALWAYS',
      cleanLevel: 'WHEN_DIRTY',
      drinkingFrequency: 'NONE',
      relationshipStyle: 'CASUAL',
      temperatureSensitivity: 'NORMAL',
      smokingTolerance: 'NO_ONLY',
      phoneTolerance: 'OUTSIDE_ONLY',
      earphoneExpectation: 'MUST',
      sleepEnvPreference: 'NO_SPEAKER',
      screenTolerance: 'NO_SCREEN',
      indoorEatingTolerance: 'NO_SMELL',
      cleanExpectation: 'STRICT',
      drinkingTolerance: 'LOW_ONLY',
    },
    intro: '안녕하세요',
    additional: {
      grade: '2',
      mbti: 'ISTJ',
    },
  };
}

describe('CurrentSeasonParticipationController', () => {
  const seasonParticipantsService = {
    getCurrentSeasonProfile: vi.fn(),
    createOrUpdateSeasonProfileDraft: vi.fn(),
    listSelectableDormitoriesForCurrentSeason: vi.fn(),
    createOrUpdateDormitorySelection: vi.fn(),
    finalizeSeasonRegistration: vi.fn(),
    deregisterCurrentSeasonParticipation: vi.fn(),
  };
  const profileController = new CurrentSeasonProfileController(seasonParticipantsService as never);
  const participationController = new CurrentSeasonParticipationController(
    seasonParticipantsService as never,
  );
  const authUser = {
    id: 'user-1',
    gender: 'M',
    campus: 'CHUNCHEON',
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST dormitory-selection은 SELECTED draft 저장 owner로만 위임한다', async () => {
    const response = {
      dormitorySelectionState: 'SELECTED',
      dormitoryId: 'dasan',
    };
    seasonParticipantsService.createOrUpdateDormitorySelection.mockResolvedValue(response);

    await expect(
      participationController.createOrUpdateDormitorySelection(authUser, { dormitoryId: 'dasan' }),
    ).resolves.toBe(response);

    expect(seasonParticipantsService.createOrUpdateDormitorySelection).toHaveBeenCalledWith(
      'user-1',
      { dormitoryId: 'dasan' },
    );
    expect(seasonParticipantsService.finalizeSeasonRegistration).not.toHaveBeenCalled();
  });

  it('POST registration은 body 없이 finalize owner로만 위임한다', async () => {
    const response = {
      participationIntent: 'REGISTERED',
      dormitorySelectionState: 'ASSIGNED',
      dormitoryId: 'dasan',
    };
    seasonParticipantsService.finalizeSeasonRegistration.mockResolvedValue(response);

    await expect(participationController.finalizeSeasonRegistration(authUser, {})).resolves.toBe(
      response,
    );

    expect(seasonParticipantsService.finalizeSeasonRegistration).toHaveBeenCalledWith('user-1');
    expect(seasonParticipantsService.createOrUpdateDormitorySelection).not.toHaveBeenCalled();
  });

  it('POST registration은 dormitoryId body를 받지 않는다', async () => {
    try {
      await participationController.finalizeSeasonRegistration(authUser, { dormitoryId: 'dasan' });
      throw new Error('Expected BadRequestException');
    } catch (error) {
      const response = getBadRequestResponse(error);
      expect(response.code).toBe('INVALID_REQUEST_BODY');
      expect(seasonParticipantsService.finalizeSeasonRegistration).not.toHaveBeenCalled();
    }
  });

  it('profile PUT은 season profile draft owner로 위임한다', async () => {
    const request = makeSeasonProfileDraftRequest();
    seasonParticipantsService.createOrUpdateSeasonProfileDraft.mockResolvedValue({ ok: true });

    await profileController.createOrUpdateSeasonProfileDraft(authUser, request);

    expect(seasonParticipantsService.createOrUpdateSeasonProfileDraft).toHaveBeenCalledWith(
      'user-1',
      request,
    );
  });

  it('domain participant context와 auth actor가 다르면 fail-closed 처리한다', async () => {
    const request = makeSeasonProfileDraftRequest();

    await expect(
      profileController.createOrUpdateSeasonProfileDraft(authUser, request, {
        userId: 'other-user',
      } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(seasonParticipantsService.createOrUpdateSeasonProfileDraft).not.toHaveBeenCalled();
  });

  it('profile PUT 세부 action error는 guard/controller가 아니라 service error를 그대로 전파한다', async () => {
    const request = makeSeasonProfileDraftRequest();
    seasonParticipantsService.createOrUpdateSeasonProfileDraft.mockRejectedValueOnce(
      seasonParticipantsErrors.seasonProfileDraftNotAllowed(),
    );

    await expect(
      profileController.createOrUpdateSeasonProfileDraft(authUser, request, {
        userId: 'user-1',
      } as never),
    ).rejects.toMatchObject({
      response: { code: 'SEASON_PROFILE_DRAFT_NOT_ALLOWED' },
    });
  });

  it('dormitory-selection 세부 validation error는 service error를 그대로 전파한다', async () => {
    seasonParticipantsService.createOrUpdateDormitorySelection.mockRejectedValueOnce(
      seasonParticipantsErrors.dormitorySelectionInvalid(),
    );

    await expect(
      participationController.createOrUpdateDormitorySelection(authUser, { dormitoryId: 'dasan' }, {
        userId: 'user-1',
      } as never),
    ).rejects.toMatchObject({
      response: { code: 'DORMITORY_SELECTION_INVALID' },
    });
  });

  it('registration 세부 action error는 service error를 그대로 전파한다', async () => {
    seasonParticipantsService.finalizeSeasonRegistration.mockRejectedValueOnce(
      seasonParticipantsErrors.registrationSeasonProfileIncomplete(),
    );

    await expect(
      participationController.finalizeSeasonRegistration(authUser, {}, {
        userId: 'user-1',
      } as never),
    ).rejects.toMatchObject({
      response: { code: 'SEASON_PARTICIPATION_PROFILE_INCOMPLETE' },
    });
  });

  it('deregister는 domain context guard 없이 service path의 deregistration policy로 위임한다', async () => {
    seasonParticipantsService.deregisterCurrentSeasonParticipation.mockRejectedValueOnce(
      seasonParticipantsErrors.deregistrationNotAllowed(),
    );

    await expect(participationController.deregister(authUser)).rejects.toMatchObject({
      response: { code: 'SEASON_PARTICIPATION_DEREGISTRATION_NOT_ALLOWED' },
    });

    expect(seasonParticipantsService.deregisterCurrentSeasonParticipation).toHaveBeenCalledWith(
      'user-1',
    );
  });
});
