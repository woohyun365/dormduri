import { describe, expect, it } from 'vitest';
import {
  emailRequestSchema,
  loginRequestSchema,
  opaqueAuthTokenSchema,
  passwordSchema,
} from '@repo/shared/auth/contract';
import { BadRequestException } from '@nestjs/common';
import {
  createSupportTicketRequestSchema,
  listSupportFaqQuerySchema,
  listSupportTicketsQuerySchema,
} from '@repo/shared/support';
import { genderSchema } from '@repo/shared/identity/primitives';
import type { SchemaParser } from './zod-request-types.js';
import {
  parseOptionalQueryValue,
  parsePathParam,
  parseQueryObject,
  parseQueryValue,
  parseRequestBody,
} from './zod-request.js';

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
    details?: Array<{ path: string; message: string; sourceMessage: string; code: string }>;
  };
}

describe('parseRequestBody', () => {
  it.each([undefined, null])(
    'pilot body ?? {} normalization keeps missing-field errors for %s',
    (input) => {
      expect(() => parseRequestBody(createSupportTicketRequestSchema, input ?? {})).toThrow(
        BadRequestException,
      );
      try {
        parseRequestBody(createSupportTicketRequestSchema, input ?? {});
      } catch (error) {
        const response = getBadRequestResponse(error);
        expect(response.formErrors).toEqual([]);
        expect(Object.keys(response.fieldErrors ?? {})).toEqual(['category', 'subject', 'body']);
      }
    },
  );

  it('optional query preserves undefined rather than null or a default', () => {
    expect(
      parseOptionalQueryValue(genderSchema, undefined, {
        code: 'GENDER',
        errorMessage: 'gender',
        fieldName: 'gender',
      }),
    ).toBeUndefined();
  });

  it('query object retains the schema nullable category', () => {
    expect(
      parseQueryObject(
        listSupportFaqQuerySchema,
        { category: null },
        { code: 'QUERY', errorMessage: 'query' },
      ),
    ).toEqual({ category: null });
  });
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
    const nestedSchema: SchemaParser<never> = {
      safeParse: (_input, options) =>
        ({
          success: false as const,
          error: {
            issues: [
              {
                path: ['profile', 'nickname'],
                message:
                  options?.error?.({ code: 'invalid_type', input: 123 }) ?? 'default type error',
                code: 'invalid_type',
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

function failureOf(parse: () => unknown) {
  try {
    parse();
  } catch (error) {
    return getBadRequestResponse(error);
  }
  throw new Error('Expected parser rejection');
}

describe('actual shared Zod input classification', () => {
  it.each([undefined, 123, null, [], {}].map((input) => ({ input })))(
    'distinguishes body field input %j without retaining it',
    ({ input }) => {
      const response = failureOf(() =>
        parseRequestBody(loginRequestSchema, {
          email: 'test@kangwon.ac.kr',
          password: input,
        }),
      );
      const message =
        input === undefined ? '필수 값이 누락되었습니다.' : '입력값 형식이 올바르지 않습니다.';
      expect(response.code).toBe('INVALID_REQUEST_BODY');
      // Installed shared schemas also emit their existing min-length issue for an empty array.
      const sizeMessages = Array.isArray(input) ? ['최소 허용 기준보다 작습니다.'] : [];
      expect(response.fieldErrors).toEqual({ password: [message, ...sizeMessages] });
      expect(response.details).toEqual([
        { path: 'password', code: 'invalid_type', message, sourceMessage: message },
        ...(Array.isArray(input)
          ? [
              {
                path: 'password',
                code: 'too_small',
                message: '최소 허용 기준보다 작습니다.',
                sourceMessage: 'Too small: expected array to have >=1 items',
              },
            ]
          : []),
      ]);
    },
  );

  it.each([undefined, null, 123, []].map((input) => ({ input })))(
    'distinguishes whole-body input %j',
    ({ input }) => {
      const response = failureOf(() => parseRequestBody(emailRequestSchema, input));
      expect(response.formErrors).toEqual([
        input === undefined ? '필수 값이 누락되었습니다.' : '입력값 형식이 올바르지 않습니다.',
      ]);
      expect(response.details?.[0]?.path).toBe('');
    },
  );

  it('absent field and explicit undefined have the same missing result', () => {
    expect(failureOf(() => parseRequestBody(emailRequestSchema, {}))).toEqual(
      failureOf(() => parseRequestBody(emailRequestSchema, { email: undefined })),
    );
  });

  it.each([undefined, 123, null, []].map((input) => ({ input })))(
    'keeps source-aware scalar query/path messages for %j',
    ({ input }) => {
      const schema = createSupportTicketRequestSchema.shape.subject;
      const query = failureOf(() =>
        parseQueryValue(schema, input, {
          code: 'QUERY',
          errorMessage: 'query',
          fieldName: 'cursor',
        }),
      );
      const path = failureOf(() =>
        parsePathParam(schema, input, { code: 'PATH', errorMessage: 'path', fieldName: 'id' }),
      );
      expect(query.fieldErrors).toEqual({
        cursor: [
          input === undefined
            ? '필수 쿼리 파라미터가 누락되었습니다.'
            : '쿼리 파라미터 형식이 올바르지 않습니다.',
          ...(Array.isArray(input) ? ['최소 허용 기준보다 작습니다.'] : []),
        ],
      });
      expect(path.fieldErrors).toEqual({
        id: [
          input === undefined
            ? '필수 경로 파라미터가 누락되었습니다.'
            : '경로 파라미터 형식이 올바르지 않습니다.',
          ...(Array.isArray(input) ? ['최소 허용 기준보다 작습니다.'] : []),
        ],
      });
      expect(query.code).toBe('QUERY');
      expect(path.code).toBe('PATH');
    },
  );

  it('keeps nested array paths and distinguishes missing from a wrong type', () => {
    const response = failureOf(() =>
      parseRequestBody(emailRequestSchema.array(), [{}, { email: 123 }]),
    );
    expect(response.fieldErrors).toEqual({
      '[0].email': ['[0].email: 필수 값이 누락되었습니다.'],
      '[1].email': ['[1].email: 입력값 형식이 올바르지 않습니다.'],
    });
    expect(response.details?.map(({ path }) => path)).toEqual(['[0].email', '[1].email']);
  });

  it('keeps schema-owned invalid_type messages ahead of per-parse localization', () => {
    const schema = passwordSchema.clone({
      ...passwordSchema.def,
      error: () => 'schema-owned type error',
    });
    const response = failureOf(() => parseRequestBody(schema, 123));
    expect(response.formErrors).toEqual(['schema-owned type error']);
    expect(response.details?.[0]?.sourceMessage).toBe('schema-owned type error');
  });

  it('keeps check-owned source messages and unrelated localization unchanged', () => {
    const schema = passwordSchema.min(5, { error: 'check-owned minimum' });
    const response = failureOf(() => parseRequestBody(schema, 'abc'));
    expect(response.formErrors).toEqual(['최소 허용 기준보다 작습니다.']);
    expect(response.details?.[0]?.sourceMessage).toBe('check-owned minimum');
    const token = failureOf(() => parseRequestBody(opaqueAuthTokenSchema, 'not-a-token'));
    expect(token.formErrors).toEqual(['opaque auth token 형식이어야 합니다.']);
  });

  it('preserves shared refinement messages, defaults, coercion, transforms and optional undefined', () => {
    const ticket = { category: 'APPEAL', subject: ' subject ', body: ' body ' };
    const response = failureOf(() => parseRequestBody(createSupportTicketRequestSchema, ticket));
    expect(response.fieldErrors?.appealCategory).toEqual([
      'appealCategory is required when category is APPEAL',
    ]);
    expect(
      parseRequestBody(createSupportTicketRequestSchema, { ...ticket, category: 'OTHER' }),
    ).toEqual({ category: 'OTHER', subject: 'subject', body: 'body', emailReplyConsent: false });
    expect(
      parseQueryObject(listSupportTicketsQuerySchema, {}, { code: 'QUERY', errorMessage: 'query' }),
    ).toEqual({ limit: 20 });
    expect(
      parseQueryObject(
        listSupportTicketsQuerySchema,
        { limit: '5' },
        { code: 'QUERY', errorMessage: 'query' },
      ),
    ).toEqual({ limit: 5 });
    const badLimit = failureOf(() =>
      parseQueryObject(
        listSupportTicketsQuerySchema,
        { limit: 'no' },
        { code: 'QUERY', errorMessage: 'query' },
      ),
    );
    expect(badLimit.fieldErrors?.limit).toEqual(['쿼리 파라미터 형식이 올바르지 않습니다.']);
    expect(parseRequestBody(emailRequestSchema, { email: 'TEST@kangwon.ac.kr' })).toEqual({
      email: 'test@kangwon.ac.kr',
    });
    expect(
      parseOptionalQueryValue(passwordSchema, undefined, {
        code: 'QUERY',
        errorMessage: 'query',
        fieldName: 'value',
      }),
    ).toBeUndefined();
  });

  it('never serializes raw password/token values from malformed input', () => {
    const secret = 'synthetic-password-token-do-not-expose';
    const response = failureOf(() =>
      parseRequestBody(loginRequestSchema, {
        email: 'test@kangwon.ac.kr',
        password: { value: secret },
      }),
    );
    expect(JSON.stringify(response)).not.toContain(secret);
    expect(response.details).toEqual([
      {
        path: 'password',
        code: 'invalid_type',
        message: '입력값 형식이 올바르지 않습니다.',
        sourceMessage: '입력값 형식이 올바르지 않습니다.',
      },
    ]);
  });
});
