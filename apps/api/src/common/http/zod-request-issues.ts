import type { ParseSource, SchemaIssue, SchemaIssuePath } from './zod-request-types.js';

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
