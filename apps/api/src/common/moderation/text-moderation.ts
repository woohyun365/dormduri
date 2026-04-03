const BLOCKED_TERMS = [
  '시발',
  '씨발',
  '개새끼',
  '병신',
  '지랄',
  '보지',
  '자지',
  '섹스',
  '야동',
  '한남',
  '한녀',
  '맘충',
  '틀딱',
  'ㅅㅂ',
  'ㅆㅂ',
  'ㅅㅅ',
] as const;

export type PublicTextSurface = 'nickname' | 'intro' | 'messageToRoommate';

function getErrorMessage(surface: PublicTextSurface): string {
  switch (surface) {
    case 'nickname':
      return '사용할 수 없는 표현이 포함되어 있습니다.';
    case 'intro':
      return '자기소개에 사용할 수 없는 표현이 포함되어 있습니다.';
    case 'messageToRoommate':
      return '텍스트에 사용할 수 없는 표현이 포함되어 있습니다.';
  }
}

export function normalizeForModeration(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}_]+/gu, '');
}

export function containsBlockedTerm(value: string): boolean {
  const normalized = normalizeForModeration(value);
  return BLOCKED_TERMS.some((term) => normalized.includes(normalizeForModeration(term)));
}

export function moderatePublicText(
  value: string,
  surface: PublicTextSurface,
): { ok: true } | { ok: false; error: string } {
  if (!value.trim()) {
    return { ok: true };
  }

  if (containsBlockedTerm(value)) {
    return {
      ok: false,
      error: getErrorMessage(surface),
    };
  }

  return { ok: true };
}
