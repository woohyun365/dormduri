import { BadRequestException } from '@nestjs/common';
import { ProfilesController } from './profiles.controller.js';

function getBadRequestResponse(error: unknown) {
  expect(error).toBeInstanceOf(BadRequestException);

  if (!(error instanceof BadRequestException)) {
    throw new Error('Expected BadRequestException');
  }

  const response = error.getResponse();
  expect(typeof response).toBe('object');
  expect(response).not.toBeNull();

  if (typeof response !== 'object' || response === null) {
    throw new Error('Expected object response');
  }

  return response as {
    code: string;
    fieldErrors?: Record<string, string[]>;
  };
}

describe('ProfilesController', () => {
  const profilesService = {
    getProfileByUserId: jest.fn(),
    updateLifestyle: jest.fn(),
    updateNickname: jest.fn(),
  };

  const controller = new ProfilesController(profilesService as never);
  const authUser = {
    id: 'user-1',
    gender: 'M' as const,
    campus: 'CHUNCHEON' as const,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalid lifestyle body는 bad request를 던진다', async () => {
    try {
      await controller.updateLifestyle(authUser as never, { bedtime: 'INVALID' });
      throw new Error('Expected updateLifestyle to throw');
    } catch (error) {
      const response = getBadRequestResponse(error);
      expect(response.code).toBe('INVALID_REQUEST_BODY');
    }
  });
});
