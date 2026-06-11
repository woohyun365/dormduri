export type PublicTextSurface = 'nickname' | 'intro' | 'matchRequestNote';
export type ModerationMatchMode = 'EXACT' | 'INCLUDES';

export interface ModerationTermEntry {
  term: string;
  normalizedTerm: string;
  matchMode: ModerationMatchMode;
}

export function getErrorMessage(surface: PublicTextSurface): string {
  switch (surface) {
    case 'nickname':
      return '사용할 수 없는 표현이 포함되어 있습니다.';
    case 'intro':
      return '자기소개에 사용할 수 없는 표현이 포함되어 있습니다.';
    case 'matchRequestNote':
      return '매칭 신청 메시지에 사용할 수 없는 표현이 포함되어 있습니다.';
  }
}

export function normalizeForModeration(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}_]+/gu, '');
}

export function matchesModerationTerm(normalizedValue: string, term: ModerationTermEntry): boolean {
  if (term.matchMode === 'EXACT') {
    return normalizedValue === term.normalizedTerm;
  }

  return normalizedValue.includes(term.normalizedTerm);
}
