import { getCollegeCatalog, getCollegeLabel } from '@repo/shared/college';
import { PROFILE_GRADE_VALUES, type PublicProfileAdditional } from '@repo/shared/profile/contract';

const PROFILE_BIRTH_YEAR_MIN = 1998;
const PROFILE_BIRTH_YEAR_MAX = 2008;

export const COLLEGE_OPTIONS = getCollegeCatalog('CHUNCHEON').map((item) => ({
  value: item.code,
  label: item.nameKo,
}));

const GRADE_LABELS: Record<(typeof PROFILE_GRADE_VALUES)[number], string> = {
  '1': '1학년',
  '2': '2학년',
  '3': '3학년',
  '4+': '4학년 이상',
};

export const GRADE_OPTIONS = PROFILE_GRADE_VALUES.map((value) => ({
  value,
  label: GRADE_LABELS[value],
}));

export const MBTI_DIMENSIONS = [
  { key: 'EI', options: ['E', 'I'] },
  { key: 'SN', options: ['S', 'N'] },
  { key: 'TF', options: ['T', 'F'] },
  { key: 'JP', options: ['J', 'P'] },
] as const;

export const BIRTH_YEAR_OPTIONS = Array.from(
  { length: PROFILE_BIRTH_YEAR_MAX - PROFILE_BIRTH_YEAR_MIN + 1 },
  (_, index) => {
    const value = PROFILE_BIRTH_YEAR_MAX - index;
    return { value, label: `${value}년` };
  },
);

export const ADDITIONAL_FIELD_LABELS: Record<keyof PublicProfileAdditional, string> = {
  college: '단과대',
  grade: '학년',
  mbti: 'MBTI',
  birthYear: '출생연도',
};

export type ProfileAdditional = PublicProfileAdditional;

export { getCollegeLabel };
