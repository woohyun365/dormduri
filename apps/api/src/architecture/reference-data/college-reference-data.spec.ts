// @ts-expect-error -- seed reference data is plain JS and intentionally imported for regression coverage
import { COLLEGE_MASTER_DATA } from '../../../prisma/seed-data/reference/college-reference-data.js';
import { CHUNCHEON_COLLEGE_CATALOG, type CollegeCatalogItem } from '@repo/shared/college';

const collegeMasterData = COLLEGE_MASTER_DATA as CollegeCatalogItem[];

describe('college reference seed data', () => {
  it('춘천 단과대 real data를 shared catalog와 같은 개수로 제공한다', () => {
    expect(collegeMasterData).toHaveLength(CHUNCHEON_COLLEGE_CATALOG.length);
    expect(collegeMasterData.every((item) => item.campusCode === 'CHUNCHEON')).toBe(true);
  });

  it('seed row는 code/nameKo/sortOrder/isActive를 모두 가진다', () => {
    expect(collegeMasterData[0]).toMatchObject({
      code: 'IT',
      campusCode: 'CHUNCHEON',
      nameKo: 'IT대',
      sortOrder: 1,
      isActive: true,
    });
  });
});
