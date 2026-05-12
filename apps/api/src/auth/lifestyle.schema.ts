import { CORE_LIFESTYLE_FIELDS, lifestyleSchema, type LifestyleData } from '@repo/shared/lifestyle';

export type { LifestyleData };

const SIGNUP_REQUIRED_LIFESTYLE_FIELDS = [
  ...CORE_LIFESTYLE_FIELDS,
  'drinkingTolerance',
] as const satisfies readonly (keyof LifestyleData)[];

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

export function validateSignupLifestyleData(
  input: unknown,
): { ok: true; value: LifestyleData } | { ok: false; error: string } {
  const result = validateLifestyleData(input);
  if (!result.ok) {
    return result;
  }

  for (const field of SIGNUP_REQUIRED_LIFESTYLE_FIELDS) {
    if (result.value[field] === null) {
      return {
        ok: false,
        error: `${field} 필드는 필수입니다.`,
      };
    }
  }

  return result;
}
