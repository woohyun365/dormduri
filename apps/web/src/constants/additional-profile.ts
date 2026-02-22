export interface AdditionalProfile {
  college: string | null;
  grade: string | null;
  mbti: string | null;
  temperatureSensitivity: string | null;
}

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

export const GRADES = [
  { value: '1', label: '1학년' },
  { value: '2', label: '2학년' },
  { value: '3', label: '3학년' },
  { value: '4+', label: '4학년 이상' },
] as const;

export const MBTI_DIMENSIONS = [
  { key: 'EI', options: ['E', 'I'] },
  { key: 'SN', options: ['S', 'N'] },
  { key: 'TF', options: ['T', 'F'] },
  { key: 'JP', options: ['J', 'P'] },
] as const;

export const TEMPERATURE_SENSITIVITY = [
  { value: 'COLD', label: '추위 타요' },
  { value: 'NORMAL', label: '보통' },
  { value: 'HOT', label: '더위 타요' },
] as const;

export const ADDITIONAL_FIELD_NAMES: Record<keyof AdditionalProfile, string> = {
  college: '단대',
  grade: '학년',
  mbti: 'MBTI',
  temperatureSensitivity: '온도 민감도',
};
