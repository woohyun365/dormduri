function normalizeForModeration(value) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}_]+/gu, '');
}

const sharedBlockedTerms = [
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
];

const reservedNicknameTerms = [
  { term: '관리자', matchMode: 'INCLUDES' },
  { term: '운영자', matchMode: 'INCLUDES' },
  { term: '운영팀', matchMode: 'INCLUDES' },
  { term: '테스트', matchMode: 'INCLUDES' },
  { term: 'admin', matchMode: 'EXACT' },
  { term: 'system', matchMode: 'EXACT' },
  { term: 'test', matchMode: 'EXACT' },
  { term: 'demo', matchMode: 'EXACT' },
];

export const MODERATION_REFERENCE_ROWS = [
  ...sharedBlockedTerms.map((term) => ({
    term,
    normalizedTerm: normalizeForModeration(term),
    category: 'BLOCKED_TEXT',
    matchMode: 'INCLUDES',
    surface: 'ALL',
    isActive: true,
  })),
  ...reservedNicknameTerms.map((term) => ({
    term: term.term,
    normalizedTerm: normalizeForModeration(term.term),
    category: 'RESERVED_NICKNAME',
    matchMode: term.matchMode,
    surface: 'NICKNAME',
    isActive: true,
  })),
];
