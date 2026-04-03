import { AuthController } from './auth.controller.js';

describe('AuthController', () => {
  const authService = {
    sendSignupCode: jest.fn(),
    sendResetCode: jest.fn(),
    verifyEmailCode: jest.fn(),
    verifyResetCode: jest.fn(),
    getSession: jest.fn(),
    signup: jest.fn(),
    login: jest.fn(),
    resetPassword: jest.fn(),
    logout: jest.fn(),
  };

  const controller = new AuthController(authService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('body가 없을 때 500 대신 공통 에러를 반환한다', async () => {
    await expect(controller.sendResetCode(undefined, { ip: null } as never)).resolves.toEqual({
      success: false,
      error: '요청 본문이 올바르지 않습니다.',
    });

    await expect(controller.login(undefined)).resolves.toEqual({
      success: false,
      error: '요청 본문이 올바르지 않습니다.',
    });
  });
});
