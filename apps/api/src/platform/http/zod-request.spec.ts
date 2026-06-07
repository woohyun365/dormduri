import { emailRequestSchema, loginRequestSchema } from '@repo/shared/auth-contract';
import { BadRequestException } from '@nestjs/common';
import { parsePathParam, parseQueryValue, parseRequestBody } from './zod-request.js';

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
    details?: Array<{ path: string; message: string }>;
  };
}

describe('parseRequestBody', () => {
  it('최상위 잘못된 body는 formErrors와 details를 포함한다', () => {
    try {
      parseRequestBody(emailRequestSchema, undefined);
      throw new Error('Expected parseRequestBody to throw');
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.code).toBe('INVALID_REQUEST_BODY');
      expect(response.formErrors?.length).toBeGreaterThan(0);
      expect(
        response.details?.some((detail) => detail.path === '' && detail.message.length > 0),
      ).toBe(true);
    }
  });

  it('필드 누락은 fieldErrors를 포함한다', () => {
    try {
      parseRequestBody(loginRequestSchema, {});
      throw new Error('Expected parseRequestBody to throw');
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.code).toBe('INVALID_REQUEST_BODY');
      expect(response.fieldErrors?.email?.length).toBeGreaterThan(0);
      expect(response.fieldErrors?.password?.length).toBeGreaterThan(0);
      expect(response.details?.some((detail) => detail.path === 'email')).toBe(true);
      expect(response.details?.some((detail) => detail.path === 'password')).toBe(true);
    }
  });

  it('nested field path는 details와 fieldErrors에 점 표기법으로 남는다', () => {
    const nestedSchema = {
      safeParse: () =>
        ({
          success: false as const,
          error: {
            issues: [
              {
                path: ['profile', 'nickname'],
                message: 'Invalid input: expected string, received number',
                code: 'invalid_type',
                input: 123,
              },
            ],
          },
        }) as const,
    };

    try {
      parseRequestBody(nestedSchema, { profile: { nickname: 123 } });
      throw new Error('Expected parseRequestBody to throw');
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.fieldErrors?.['profile.nickname']?.length).toBeGreaterThan(0);
      expect(response.details?.some((detail) => detail.path === 'profile.nickname')).toBe(true);
      expect(
        response.details?.some((detail) => detail.message === '입력값 형식이 올바르지 않습니다.'),
      ).toBe(true);
    }
  });

  it('query parser는 필드명 기준으로 localized fieldErrors를 포함한다', () => {
    const enumLikeSchema = {
      safeParse: () =>
        ({
          success: false as const,
          error: {
            issues: [
              {
                path: [],
                message: 'Invalid option',
                code: 'invalid_value',
              },
            ],
          },
        }) as const,
    };

    try {
      parseQueryValue(enumLikeSchema, 'WRONG', {
        code: 'INVALID_QUERY',
        errorMessage: '쿼리 값이 올바르지 않습니다.',
        fieldName: 'campus',
      });
      throw new Error('Expected parseQueryValue to throw');
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.code).toBe('INVALID_QUERY');
      expect(response.fieldErrors?.campus).toEqual(['허용되지 않는 쿼리 파라미터 값입니다.']);
      expect(response.details?.some((detail) => detail.path === 'campus')).toBe(true);
    }
  });

  it('path param parser는 경로 파라미터 기준 localized fieldErrors를 포함한다', () => {
    const enumLikeSchema = {
      safeParse: () =>
        ({
          success: false as const,
          error: {
            issues: [
              {
                path: [],
                message: 'Invalid option',
                code: 'invalid_value',
              },
            ],
          },
        }) as const,
    };

    try {
      parsePathParam(enumLikeSchema, 'WRONG', {
        code: 'INVALID_PARAM',
        errorMessage: '경로 파라미터가 올바르지 않습니다.',
        fieldName: 'campusCode',
      });
      throw new Error('Expected parsePathParam to throw');
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.code).toBe('INVALID_PARAM');
      expect(response.fieldErrors?.campusCode).toEqual(['허용되지 않는 경로 파라미터 값입니다.']);
      expect(response.details?.some((detail) => detail.path === 'campusCode')).toBe(true);
    }
  });
});
