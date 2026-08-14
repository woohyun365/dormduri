import { describe, expect, it } from 'vitest';
// @ts-expect-error -- seed reference data is plain JS and intentionally imported for regression coverage
import { COLLEGE_REFERENCE_DATA } from '../../../prisma/seeds/reference/colleges/college-reference-data.js';
import {
  CHUNCHEON_COLLEGE_CATALOG,
  COLLEGE_CATALOG,
  DOGYE_COLLEGE_CATALOG,
  SAMCHEOK_COLLEGE_CATALOG,
  type CollegeCatalogItem,
} from '@repo/shared/college';

const collegeMasterData = COLLEGE_REFERENCE_DATA as CollegeCatalogItem[];

describe('college reference seed data', () => {
  it('세 캠퍼스 단과대 real data를 shared catalog와 같은 개수로 제공한다', () => {
    expect(collegeMasterData).toHaveLength(COLLEGE_CATALOG.length);
    expect(collegeMasterData.filter((item) => item.campusCode === 'CHUNCHEON')).toHaveLength(
      CHUNCHEON_COLLEGE_CATALOG.length,
    );
    expect(collegeMasterData.filter((item) => item.campusCode === 'SAMCHEOK')).toHaveLength(
      SAMCHEOK_COLLEGE_CATALOG.length,
    );
    expect(collegeMasterData.filter((item) => item.campusCode === 'DOGYE')).toHaveLength(
      DOGYE_COLLEGE_CATALOG.length,
    );
  });

  it('seed row는 code/nameKo/sortOrder/isActive를 모두 가진다', () => {
    expect(collegeMasterData[0]).toMatchObject({
      code: 'CHUNCHEON_NURSING',
      campusCode: 'CHUNCHEON',
      nameKo: '간호대',
      sortOrder: 1,
      isActive: true,
    });
  });

  it('모든 단과대 code가 campus ownership을 드러낸다', () => {
    expect(collegeMasterData.every((item) => item.code.startsWith(`${item.campusCode}_`))).toBe(
      true,
    );
  });

  it('삼척·도계에서 같은 단과대 명칭을 캠퍼스별 안정적인 code로 분리한다', () => {
    expect(collegeMasterData).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SAMCHEOK_ENGINEERING',
          campusCode: 'SAMCHEOK',
          nameKo: '공학대',
        }),
        expect.objectContaining({
          code: 'DOGYE_ENGINEERING',
          campusCode: 'DOGYE',
          nameKo: '공학대',
        }),
      ]),
    );
  });
});
