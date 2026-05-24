import { ProfilesController } from './profiles.controller.js';

describe('ProfilesController', () => {
  const profilesService = {
    getProfileByUserId: jest.fn(),
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

  it('public detail 조회를 ProfilesService로 위임한다', async () => {
    profilesService.getProfileByUserId.mockResolvedValue({ id: 'target-user' });

    await expect(controller.getProfileByUserId(authUser as never, 'target-user')).resolves.toEqual({
      id: 'target-user',
    });

    expect(profilesService.getProfileByUserId).toHaveBeenCalledWith(authUser, 'target-user');
  });
});
