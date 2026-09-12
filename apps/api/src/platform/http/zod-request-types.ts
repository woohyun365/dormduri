export type SchemaIssuePath = ReadonlyArray<string | number | symbol>;

export interface SchemaIssue {
  path: SchemaIssuePath;
  message: string;
  code?: string;
  keys?: string[];
}

// Raw parse callbacks run before Zod redacts input from finalized issues.
export interface SchemaParseIssue {
  readonly code: string;
  readonly input: unknown;
}

export interface SchemaParser<T> {
  safeParse(
    input: unknown,
    options?: { error?: (issue: SchemaParseIssue) => string | undefined },
  ): { success: true; data: T } | { success: false; error: { issues: readonly SchemaIssue[] } };
}

export type ParseSource = 'body' | 'query' | 'param';
