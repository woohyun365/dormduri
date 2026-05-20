import { BadRequestException, RequestMethod } from '@nestjs/common';
import { AuthController } from './auth.controller.js';

const NEST_ROUTE_PATH_METADATA = 'path';
const NEST_ROUTE_METHOD_METADATA = 'method';

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
    validateSignupDraft: jest.fn(),
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

  it('signup body는 lifestyle/intro legacy profile orchestration 필드를 거부한다', async () => {
    await expect(
      controller.signup({
        email: 'test@kangwon.ac.kr',
        password: 'Test1234',
        nickname: '테스터',
        gender: 'M',
        campus: 'CHUNCHEON',
        lifestyle: {},
        intro: '가입 단계 소개',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(authService.signup).not.toHaveBeenCalled();
  });

  it('signup draft validation route는 /auth/validate-signup-draft로 노출된다', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      AuthController.prototype,
      'validateSignupDraft',
    ) as TypedPropertyDescriptor<(body: unknown) => Promise<unknown>> | undefined;
    const handler = descriptor?.value;

    if (!handler) {
      throw new Error('Expected validateSignupDraft handler');
    }

    expect(Reflect.getMetadata(NEST_ROUTE_PATH_METADATA, handler)).toBe('validate-signup-draft');
    expect(Reflect.getMetadata(NEST_ROUTE_METHOD_METADATA, handler)).toBe(RequestMethod.POST);
  });

  it('validateSignupDraft는 email/password/nickname draft body를 parse해 service로 위임한다', async () => {
    authService.validateSignupDraft.mockResolvedValue({ success: true });

    await expect(
      controller.validateSignupDraft({
        email: 'test@kangwon.ac.kr',
        password: 'Test1234',
        nickname: '테스터',
      }),
    ).resolves.toEqual({ success: true });

    expect(authService.validateSignupDraft).toHaveBeenCalledWith({
      email: 'test@kangwon.ac.kr',
      password: 'Test1234',
      nickname: '테스터',
    });
  });

  it('validateSignupDraft는 lifestyle/intro/profile field를 signup draft request에서 거부한다', async () => {
    await expect(
      controller.validateSignupDraft({
        email: 'test@kangwon.ac.kr',
        password: 'Test1234',
        nickname: '테스터',
        lifestyle: {},
        intro: '가입 단계 소개',
        profile: { intro: 'legacy profile' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(authService.validateSignupDraft).not.toHaveBeenCalled();
  });
});
