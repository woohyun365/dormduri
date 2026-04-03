import type { PublicTextSurface } from './text-moderation.js';
import { normalizeForModeration } from './text-moderation.js';

export interface ModerationSeedTerm {
  term: string;
  category: 'BLOCKED_TEXT' | 'RESERVED_NICKNAME';
  matchMode: 'EXACT' | 'INCLUDES';
  surface: 'ALL' | 'NICKNAME' | 'INTRO';
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
] as const;

const reservedNicknameTerms = [
  { term: '관리자', matchMode: 'INCLUDES' },
  { term: '운영자', matchMode: 'INCLUDES' },
  { term: '운영팀', matchMode: 'INCLUDES' },
  { term: '테스트', matchMode: 'INCLUDES' },
  { term: 'admin', matchMode: 'EXACT' },
  { term: 'system', matchMode: 'EXACT' },
  { term: 'test', matchMode: 'EXACT' },
  { term: 'demo', matchMode: 'EXACT' },
] as const;

export const DEFAULT_MODERATION_TERMS: ModerationSeedTerm[] = [
  ...sharedBlockedTerms.map((term) => ({
    term,
    category: 'BLOCKED_TEXT' as const,
    matchMode: 'INCLUDES' as const,
    surface: 'ALL' as const,
  })),
  ...reservedNicknameTerms.map((term) => ({
    term: term.term,
    category: 'RESERVED_NICKNAME' as const,
    matchMode: term.matchMode,
    surface: 'NICKNAME' as const,
  })),
];

export function buildDefaultModerationRows() {
  return DEFAULT_MODERATION_TERMS.map((term) => ({
    term: term.term,
    normalizedTerm: normalizeForModeration(term.term),
    category: term.category,
    matchMode: term.matchMode,
    surface: term.surface,
    isActive: true,
  }));
}

export function toModerationSurfaceValue(surface: PublicTextSurface): 'NICKNAME' | 'INTRO' {
  switch (surface) {
    case 'nickname':
      return 'NICKNAME';
    case 'intro':
      return 'INTRO';
  }
}
