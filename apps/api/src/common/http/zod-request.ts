import { badRequestError } from './api-error.js';

interface SchemaParser<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

export function parseRequestBody<T>(
  schema: SchemaParser<T>,
  input: unknown,
  errorMessage: string = '요청 본문이 올바르지 않습니다.',
): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw badRequestError('INVALID_REQUEST_BODY', errorMessage);
  }

  return result.data;
}
