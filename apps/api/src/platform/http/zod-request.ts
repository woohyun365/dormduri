import { badRequestError } from './api-error.js';
import { toSchemaErrorExtras } from './zod-request-error-extras.js';
import { toParseIssueMessage } from './zod-request-issues.js';
import type { ParseSource, SchemaParser } from './zod-request-types.js';

function parseSchemaInput<T>(
  schema: SchemaParser<T>,
  input: unknown,
  options: {
    code: string;
    errorMessage: string;
    source: ParseSource;
    fieldName?: string;
  },
): T {
  const result = schema.safeParse(input, {
    error: (issue) => toParseIssueMessage(issue, options.source),
  });

  if (!result.success) {
    throw badRequestError(
      options.code,
      options.errorMessage,
      toSchemaErrorExtras(result.error.issues, options.source, options.fieldName),
    );
  }

  return result.data;
}

export function parseRequestBody<T>(
  schema: SchemaParser<T>,
  input: unknown,
  errorMessage: string = '요청 본문이 올바르지 않습니다.',
): T {
  return parseSchemaInput(schema, input, {
    code: 'INVALID_REQUEST_BODY',
    errorMessage,
    source: 'body',
  });
}

export function parseQueryValue<T>(
  schema: SchemaParser<T>,
  input: unknown,
  options: {
    code: string;
    errorMessage: string;
    fieldName: string;
  },
): T {
  return parseSchemaInput(schema, input, {
    code: options.code,
    errorMessage: options.errorMessage,
    source: 'query',
    fieldName: options.fieldName,
  });
}

export function parsePathParam<T>(
  schema: SchemaParser<T>,
  input: unknown,
  options: {
    code: string;
    errorMessage: string;
    fieldName: string;
  },
): T {
  return parseSchemaInput(schema, input, {
    code: options.code,
    errorMessage: options.errorMessage,
    source: 'param',
    fieldName: options.fieldName,
  });
}

export function parseOptionalQueryValue<T>(
  schema: SchemaParser<T>,
  input: unknown,
  options: {
    code: string;
    errorMessage: string;
    fieldName: string;
  },
): T | undefined {
  if (input === undefined) {
    return undefined;
  }

  return parseSchemaInput(schema, input, {
    code: options.code,
    errorMessage: options.errorMessage,
    source: 'query',
    fieldName: options.fieldName,
  });
}

export function parseQueryObject<T>(
  schema: SchemaParser<T>,
  input: unknown,
  options: {
    code: string;
    errorMessage: string;
  },
): T {
  return parseSchemaInput(schema, input, {
    code: options.code,
    errorMessage: options.errorMessage,
    source: 'query',
  });
}
