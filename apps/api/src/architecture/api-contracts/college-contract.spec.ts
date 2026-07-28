import { describe, expect, it } from 'vitest';
import {
  collegeCodeSchema,
  getCollegeCatalog,
  getCollegeCodeByLabel,
  getCollegeLabel,
  isCollegeAvailableForCampus,
} from '@repo/shared/college';

describe('college contract', () => {
  it('arbitrary string college code를 거부한다', () => {
    expect(collegeCodeSchema.safeParse('CYBER_CULTURE').success).toBe(false);
  });

  it('known college code는 허용하고 label을 조회할 수 있다', () => {
    expect(collegeCodeSchema.parse('CHUNCHEON_IT')).toBe('CHUNCHEON_IT');
    expect(getCollegeLabel('CHUNCHEON_IT')).toBe('IT대');
  });

  it('2026 춘천 단과대 catalog를 공식 조직 단위로 제공한다', () => {
    expect(getCollegeCatalog('CHUNCHEON').map((college) => college.nameKo)).toEqual([
      '간호대',
      '경영대',
      '농업생명대',
      '동물생명대',
      '문화예술·공대',
      '사범대',
      '사회과학대',
      '산림환경대',
      '수의대',
      '약대',
      '의대',
      '의생명과학대',
      '인문대',
      '자연과학대',
      'IT대',
      '글로벌미래융합대',
    ]);
  });

  it('2026 삼척·도계 단과대 catalog를 캠퍼스별로 제공한다', () => {
    expect(getCollegeCatalog('SAMCHEOK').map((college) => college.nameKo)).toEqual([
      '공학대',
      '인문사회대',
      '디자인스포츠대',
    ]);
    expect(getCollegeCatalog('DOGYE').map((college) => college.nameKo)).toEqual([
      '공학대',
      '인문사회대',
      '보건과학대',
      '자유전공학부',
    ]);
  });

  it('동일한 단과대 명칭은 campus context 없이 임의 code로 해석하지 않는다', () => {
    expect(getCollegeCodeByLabel('공학대')).toBeNull();
    expect(getCollegeCodeByLabel('공학대', 'SAMCHEOK')).toBe('SAMCHEOK_ENGINEERING');
    expect(getCollegeCodeByLabel('공학대', 'DOGYE')).toBe('DOGYE_ENGINEERING');
  });

  it('college code와 campus 조합을 함께 검증한다', () => {
    expect(isCollegeAvailableForCampus('SAMCHEOK', 'SAMCHEOK_ENGINEERING')).toBe(true);
    expect(isCollegeAvailableForCampus('SAMCHEOK', 'DOGYE_ENGINEERING')).toBe(false);
  });
});
