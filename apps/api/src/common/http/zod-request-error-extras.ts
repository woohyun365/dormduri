import type { ParseSource, SchemaIssue } from './zod-request-types.js';
import { formatIssuePath, toLocalizedIssueMessage } from './zod-request-issues.js';

export function toSchemaErrorExtras(
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
