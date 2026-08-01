export type PublicTextSurface = 'nickname' | 'intro' | 'matchRequestNote';
export type ModerationMatchMode = 'EXACT' | 'INCLUDES' | 'PREFIX';

export interface ModerationTermEntry {
  term: string;
  normalizedTerm: string;
  matchMode: ModerationMatchMode;
}

export function getErrorMessage(surface: PublicTextSurface): string {
  switch (surface) {
    case 'nickname':
      return '닉네임에 사용할 수 없는 단어가 포함되어 있어요.';
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

function getModerationMatchCandidates(normalizedValue: string): string[] {
  const digitInsertionCollapsed = normalizedValue.replace(
    /(\p{Script=Hangul})\d+(?=\p{Script=Hangul})/gu,
    '$1',
  );

  return digitInsertionCollapsed === normalizedValue
    ? [normalizedValue]
    : [normalizedValue, digitInsertionCollapsed];
}

export function matchesModerationTerm(normalizedValue: string, term: ModerationTermEntry): boolean {
  return getModerationMatchCandidates(normalizedValue).some((candidate) => {
    if (term.matchMode === 'EXACT') {
      return candidate === term.normalizedTerm;
    }
    if (term.matchMode === 'PREFIX') {
      return candidate.startsWith(term.normalizedTerm);
    }

    return candidate.includes(term.normalizedTerm);
  });
}
