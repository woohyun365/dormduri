import { lifestyleSchema, type LifestyleData } from '@repo/shared/lifestyle';

export type { LifestyleData };

export function validateLifestyleData(
  input: unknown,
): { ok: true; value: LifestyleData } | { ok: false; error: string } {
  const result = lifestyleSchema.safeParse(input);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    if (firstIssue?.message?.startsWith('Invalid option') && firstIssue.path[0]) {
      return {
        ok: false,
        error: `${String(firstIssue.path[0])} 값이 정책에 정의된 enum 범위를 벗어났습니다.`,
      };
    }
    if (firstIssue?.message?.startsWith('Unrecognized key')) {
      const unknownKey = firstIssue.message.match(/"(.+?)"/)?.[1];
      return {
        ok: false,
        error: `알 수 없는 생활패턴 필드가 포함되어 있습니다: ${unknownKey ?? 'unknown'}`,
      };
    }
    return {
      ok: false,
      error: firstIssue?.message ?? '생활패턴 데이터 형식이 올바르지 않습니다.',
    };
  }

  return { ok: true, value: result.data };
}
