export type College =
  | 'IT대'
  | '간호대'
  | '경영대'
  | '농업생명대'
  | '동물생명대'
  | '문화예술·공대'
  | '사범대'
  | '사회과학대'
  | '산림환경대'
  | '의·약·수의대'
  | '의생명과학대'
  | '인문대'
  | '자연과학대'
  | '자유전공';

export type Grade = '1' | '2' | '3' | '4+';
export type TempSensitivity = 'COLD' | 'NORMAL' | 'HOT';

export interface AdditionalProfile {
  college: College | null;
  grade: Grade | null;
  mbti: string | null;
  temperatureSensitivity: TempSensitivity | null;
}
