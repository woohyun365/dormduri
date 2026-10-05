import type {
  ParseSource,
  SchemaIssue,
  SchemaIssuePath,
  SchemaParseIssue,
} from './zod-request-types.js';

export function formatIssuePath(path: SchemaIssuePath): string {
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

export function toLocalizedIssueMessage(issue: SchemaIssue, source: ParseSource): string {
  const sourceLabel =
    source === 'query' ? '쿼리 항목' : source === 'param' ? '경로 파라미터' : '필드';

  if (issue.code === 'unrecognized_keys') {
    const keys = Array.isArray(issue.keys) ? issue.keys.join(', ') : '';
    return keys
      ? `알 수 없는 ${sourceLabel}가 포함되어 있습니다: ${keys}`
      : `알 수 없는 ${sourceLabel}가 포함되어 있습니다.`;
  }

  if (issue.code === 'invalid_type') {
    // Already resolved during parsing, including higher-priority schema custom errors.
    return issue.message;
  }

  if (issue.code === 'invalid_value') {
    return source === 'query'
      ? '허용되지 않는 쿼리 파라미터 값입니다.'
      : source === 'param'
        ? '허용되지 않는 경로 파라미터 값입니다.'
        : '허용되지 않는 값입니다.';
  }

  if (issue.code === 'too_small') {
    return '최소 허용 기준보다 작습니다.';
  }

  if (issue.code === 'too_big') {
    return '최대 허용 기준을 초과했습니다.';
  }

  return issue.message || '입력값이 올바르지 않습니다.';
}

export function toParseIssueMessage(
  issue: SchemaParseIssue,
  source: ParseSource,
): string | undefined {
  if (issue.code !== 'invalid_type') return undefined;
  if (issue.input === undefined) {
    return source === 'query'
      ? '필수 쿼리 파라미터가 누락되었습니다.'
      : source === 'param'
        ? '필수 경로 파라미터가 누락되었습니다.'
        : '필수 값이 누락되었습니다.';
  }
  const label =
    source === 'query' ? '쿼리 파라미터' : source === 'param' ? '경로 파라미터' : '입력값';
  return `${label} 형식이 올바르지 않습니다.`;
}
