import { BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller.js';

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
    formErrors?: string[];
    fieldErrors?: Record<string, string[]>;
    details?: Array<{ path: string }>;
  };
}

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
    try {
      await controller.sendResetCode(undefined, { ip: null } as never);
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.code).toBe('INVALID_REQUEST_BODY');
      expect(response.formErrors?.length).toBeGreaterThan(0);
      expect(response.details?.some((detail) => detail.path === '')).toBe(true);
    }

    await expect(controller.login(undefined)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('필드 누락 body는 fieldErrors를 포함한다', async () => {
    try {
      await controller.login({});
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.code).toBe('INVALID_REQUEST_BODY');
      expect(response.fieldErrors?.email?.length).toBeGreaterThan(0);
      expect(response.fieldErrors?.password?.length).toBeGreaterThan(0);
    }
  });
});
