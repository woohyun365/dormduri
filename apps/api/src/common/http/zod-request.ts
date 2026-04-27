import { badRequestError } from './api-error.js';

type SchemaIssuePath = ReadonlyArray<string | number | symbol>;

interface SchemaIssue {
  path: SchemaIssuePath;
  message: string;
  code?: string;
  input?: unknown;
  keys?: string[];
}

interface SchemaParser<T> {
  safeParse(
    input: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: readonly SchemaIssue[] } };
}

type ParseSource = 'body' | 'query';

function formatIssuePath(path: SchemaIssuePath): string {
  if (path.length === 0) {
    return '';
  }

  return path
    .map((segment, index) =>
      typeof segment === 'number'
        ? `[${segment}]`
        : index === 0
          ? String(segment)
          : `.${String(segment)}`,
    )
    .join('');
}

function toLocalizedIssueMessage(issue: SchemaIssue, source: ParseSource): string {
  if (issue.code === 'unrecognized_keys') {
    const keys = Array.isArray(issue.keys) ? issue.keys.join(', ') : '';
    return keys
      ? `알 수 없는 ${source === 'query' ? '쿼리 항목' : '필드'}가 포함되어 있습니다: ${keys}`
      : `알 수 없는 ${source === 'query' ? '쿼리 항목' : '필드'}가 포함되어 있습니다.`;
  }

  if (issue.code === 'invalid_type') {
    if (issue.input === undefined) {
      return source === 'query'
        ? '필수 쿼리 파라미터가 누락되었습니다.'
        : '필수 값이 누락되었습니다.';
    }
    return source === 'query'
      ? '쿼리 파라미터 형식이 올바르지 않습니다.'
      : '입력값 형식이 올바르지 않습니다.';
  }

  if (issue.code === 'invalid_value') {
    return source === 'query' ? '허용되지 않는 쿼리 파라미터 값입니다.' : '허용되지 않는 값입니다.';
  }

  if (issue.code === 'too_small') {
    return '최소 허용 기준보다 작습니다.';
  }

  if (issue.code === 'too_big') {
    return '최대 허용 기준을 초과했습니다.';
  }

  return issue.message || '입력값이 올바르지 않습니다.';
}

function toSchemaErrorExtras(
  issues: readonly SchemaIssue[],
  source: ParseSource,
  fieldName?: string,
) {
  const formErrors: string[] = [];
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of issues) {
    const path = issue.path.length > 0 ? formatIssuePath(issue.path) : (fieldName ?? '');
    const localizedMessage = toLocalizedIssueMessage(issue, source);

    if (path) {
      fieldErrors[path] ??= [];
      const message = issue.path.length > 1 ? `${path}: ${localizedMessage}` : localizedMessage;
      fieldErrors[path].push(message);
      continue;
    }

    formErrors.push(localizedMessage);
  }

  return {
    formErrors,
    fieldErrors,
    details: issues.map((issue) => ({
      path: issue.path.length > 0 ? formatIssuePath(issue.path) : (fieldName ?? ''),
      message: toLocalizedIssueMessage(issue, source),
      sourceMessage: issue.message,
      code: issue.code ?? 'custom',
    })),
  };
}

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
  const result = schema.safeParse(input);

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
