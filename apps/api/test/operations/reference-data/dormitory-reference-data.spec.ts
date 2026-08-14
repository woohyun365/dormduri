import { describe, expect, it } from 'vitest';
// @ts-expect-error -- seed reference data is plain JS and intentionally imported for regression coverage
import { CAMPUS_REFERENCE_DATA } from '../../../prisma/seeds/reference/common/campus-reference-data.js';
// @ts-expect-error -- seed reference data is plain JS and intentionally imported for regression coverage
import { DORMITORY_REFERENCE_DATA } from '../../../prisma/seeds/reference/dormitories/dormitory-reference-data.js';

type DormitoryReferenceRow = {
  id: string;
  campusCode: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  nameKo: string;
  roomType: 2 | 3;
  genderPolicy: 'M' | 'F' | 'BOTH';
  matchingSupported: boolean;
  isActive: boolean;
  sortOrder: number;
};

const dormitoryReferenceData = DORMITORY_REFERENCE_DATA as DormitoryReferenceRow[];

describe('dormitory reference seed data', () => {
  it('세 캠퍼스를 운영 campus reference로 제공한다', () => {
    expect(CAMPUS_REFERENCE_DATA).toEqual([
      expect.objectContaining({ code: 'CHUNCHEON', isOperated: true }),
      expect.objectContaining({ code: 'SAMCHEOK', isOperated: true }),
      expect.objectContaining({ code: 'DOGYE', isOperated: true }),
    ]);
  });

  it('2026 공식 운영 생활관을 캠퍼스별로 제공한다', () => {
    const namesForCampus = (campusCode: DormitoryReferenceRow['campusCode']) =>
      dormitoryReferenceData
        .filter((dormitory) => dormitory.campusCode === campusCode)
        .map((dormitory) => dormitory.nameKo);

    expect(namesForCampus('CHUNCHEON')).toEqual([
      '다산관',
      '예지원',
      '국제생활관',
      '국제인재양성관',
      '새롬관',
      '이룸관',
      '다온관',
    ]);
    expect(namesForCampus('SAMCHEOK')).toEqual(['해솔관', '두타관', '언장관']);
    expect(namesForCampus('DOGYE')).toEqual([
      '가온관',
      '도원관',
      '황조관(2인 세대)',
      '황조관(3인 세대)',
    ]);
  });

  it('matching master row는 stable id와 최소 정책 필드만 가진다', () => {
    const ids = dormitoryReferenceData.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const row of dormitoryReferenceData) {
      expect([2, 3]).toContain(row.roomType);
      expect(['M', 'F', 'BOTH']).toContain(row.genderPolicy);
      expect(typeof row.matchingSupported).toBe('boolean');
      expect(row.isActive).toBe(true);
      expect(row).not.toHaveProperty('repairContact');
      expect(row).not.toHaveProperty('diningContact');
      expect(row).not.toHaveProperty('commonRules');
      expect(row).not.toHaveProperty('facilities');
    }
  });

  it('제한 코호트 생활관은 운영 master에 남기되 matching catalog에서는 닫는다', () => {
    expect(
      dormitoryReferenceData.filter((item) => !item.matchingSupported).map((item) => item.nameKo),
    ).toEqual(['국제생활관', '국제인재양성관']);
  });
});
