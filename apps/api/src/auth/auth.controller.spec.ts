import { BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller.js';

describe('AuthController', () => {
  const authService = {
    sendSignupCode: jest.fn(),
    sendResetCode: jest.fn(),
    verifyEmailCode: jest.fn(),
    verifyResetCode: jest.fn(),
    getSession: jest.fn(),
    validateSignupProfileDraft: jest.fn(),
    signup: jest.fn(),
    login: jest.fn(),
    resetPassword: jest.fn(),
    logout: jest.fn(),
  };

  const controller = new AuthController(authService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('body가 없을 때 bad request 예외를 던진다', async () => {
    await expect(controller.sendResetCode(undefined, { ip: null } as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    await expect(controller.login(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });
});
