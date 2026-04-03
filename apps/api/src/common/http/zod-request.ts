export interface InvalidBodyResult {
  success: false;
  error: string;
}

interface SchemaParser<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

export function parseRequestBody<T>(
  schema: SchemaParser<T>,
  input: unknown,
  errorMessage: string = '요청 본문이 올바르지 않습니다.',
): { ok: true; data: T } | { ok: false; error: InvalidBodyResult } {
  const result = schema.safeParse(input);

  if (!result.success) {
    return {
      ok: false,
      error: {
        success: false,
        error: errorMessage,
      },
    };
  }

  return {
    ok: true,
    data: result.data,
  };
}
