import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { createSupportTicketRequestSchema, listSupportFaqQuerySchema } from '@repo/shared/support';
import { campusSchema, genderSchema } from '@repo/shared/identity/primitives';
import { ZodRequestPipe } from './zod-request.pipe.js';
import {
  parseOptionalQueryValue,
  parsePathParam,
  parseQueryObject,
  parseQueryValue,
  parseRequestBody,
} from './zod-request.js';

describe('ZodRequestPipe', () => {
  it('returns the canonical parser output synchronously, without copying or extra parsing', () => {
    const output = { parsed: true };
    const parse = vi.fn(() => output);
    const pipe = new ZodRequestPipe(parse);
    expect(pipe.transform('raw')).toBe(output);
    expect(parse).toHaveBeenCalledExactlyOnceWith('raw');
  });

  it('rethrows the exact existing error, without wrapping status or extras', () => {
    const failure = new Error('parser failure');
    const pipe = new ZodRequestPipe(() => {
      throw failure;
    });
    let thrown: unknown;
    try {
      pipe.transform({});
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBe(failure);
  });

  it('keeps shared body transforms/defaults', () => {
    const pipe = new ZodRequestPipe((body: unknown) =>
      parseRequestBody(createSupportTicketRequestSchema, body ?? {}),
    );
    expect(pipe.transform({ category: 'OTHER', subject: ' subject ', body: ' body ' })).toEqual({
      category: 'OTHER',
      subject: 'subject',
      body: 'body',
      emailReplyConsent: false,
    });
  });

  it('supports existing query-object and path parser contracts without a second schema', () => {
    const query = new ZodRequestPipe((value: unknown) =>
      parseQueryObject(listSupportFaqQuerySchema, value, { code: 'QUERY', errorMessage: 'query' }),
    );
    const idSchema = createSupportTicketRequestSchema.shape.relatedEntityId.unwrap().unwrap();
    const path = new ZodRequestPipe((value: unknown) =>
      parsePathParam(idSchema, value, { code: 'PATH', errorMessage: 'path', fieldName: 'id' }),
    );
    expect(query.transform({ category: null })).toEqual({ category: null });
    expect(path.transform(' id ')).toBe('id');
  });

  it('keeps coupled input ordered and skips later validation after failure', () => {
    const parseGender = vi.fn((gender: unknown) =>
      parseOptionalQueryValue(genderSchema, gender, {
        code: 'GENDER',
        errorMessage: 'gender',
        fieldName: 'gender',
      }),
    );
    const pipe = new ZodRequestPipe((input: { campus: unknown; gender?: unknown }) => {
      const campus = parseQueryValue(campusSchema, input.campus, {
        code: 'CAMPUS',
        errorMessage: 'campus',
        fieldName: 'campus',
      });
      return { campus, gender: parseGender(input.gender) };
    });
    expect(() => pipe.transform({ campus: 'WRONG', gender: 'WRONG' })).toThrow(BadRequestException);
    expect(parseGender).not.toHaveBeenCalled();
    expect(pipe.transform({ campus: 'CHUNCHEON' })).toEqual({
      campus: 'CHUNCHEON',
      gender: undefined,
    });
  });
});
