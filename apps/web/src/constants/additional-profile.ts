export const COLLEGES = [
  'IT대',
  '간호대',
  '경영대',
  '농업생명대',
  '동물생명대',
  '문화예술·공대',
  '사범대',
  '사회과학대',
  '산림환경대',
  '의·약·수의대',
  '의생명과학대',
  '인문대',
  '자연과학대',
  '자유전공',
] as const;

export type College = (typeof COLLEGES)[number];

export const GRADES = [
  { value: '1', label: '1학년' },
  { value: '2', label: '2학년' },
  { value: '3', label: '3학년' },
  { value: '4+', label: '4학년 이상' },
] as const;

export type Grade = (typeof GRADES)[number]['value'];

export const MBTI_DIMENSIONS = [
  { key: 'EI', options: ['E', 'I'] },
  { key: 'SN', options: ['S', 'N'] },
  { key: 'TF', options: ['T', 'F'] },
  { key: 'JP', options: ['J', 'P'] },
] as const;

export const BIRTH_YEARS = [
  { value: 2008, label: '2008년' },
  { value: 2007, label: '2007년' },
  { value: 2006, label: '2006년' },
  { value: 2005, label: '2005년' },
  { value: 2004, label: '2004년' },
  { value: 2003, label: '2003년' },
  { value: 2002, label: '2002년' },
  { value: 2001, label: '2001년' },
  { value: 2000, label: '2000년' },
  { value: 1999, label: '1999년' },
  { value: 1998, label: '1998년' },
] as const;

export interface AdditionalProfile {
  college: College | null;
  grade: Grade | null;
  mbti: string | null;
  birthYear: number | null;
}

export const ADDITIONAL_FIELD_NAMES: Record<keyof AdditionalProfile, string> = {
  college: '단대',
  grade: '학년',
  mbti: 'MBTI',
  birthYear: '출생연도',
};
