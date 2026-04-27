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
    getProfiles: jest.fn(),
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

  it('unsupported query filter는 INVALID_PROFILE_QUERY bad request를 던진다', async () => {
    try {
      await controller.getProfiles(authUser as never, { campus: 'CHUNCHEON' });
      throw new Error('Expected getProfiles to throw');
    } catch (error) {
      const response = getBadRequestResponse(error);
      expect(response.code).toBe('INVALID_PROFILE_QUERY');
    }
  });
});
