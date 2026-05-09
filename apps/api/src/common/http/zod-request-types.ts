export type SchemaIssuePath = ReadonlyArray<string | number | symbol>;

export interface SchemaIssue {
  path: SchemaIssuePath;
  message: string;
  code?: string;
  input?: unknown;
  keys?: string[];
}

export interface SchemaParser<T> {
  safeParse(
    input: unknown,
  ): { success: true; data: T } | { success: false; error: { issues: readonly SchemaIssue[] } };
}

export type ParseSource = 'body' | 'query';
