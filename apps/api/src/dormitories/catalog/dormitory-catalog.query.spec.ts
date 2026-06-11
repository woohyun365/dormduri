import { DormitoryCatalogQuery } from './dormitory-catalog.query.js';

describe('DormitoryCatalogQuery', () => {
  const dormitoryCatalogRepository = {
    findCampus: jest.fn(),
    listDormitories: jest.fn(),
    findDormitoryDetail: jest.fn(),
  };
  const query = new DormitoryCatalogQuery(dormitoryCatalogRepository as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('비운영 캠퍼스는 campus meta와 빈 items를 반환한다', async () => {
    dormitoryCatalogRepository.findCampus.mockResolvedValue({
      code: 'SAMCHEOK',
      nameKo: '삼척캠퍼스',
      isOperated: false,
    });
    dormitoryCatalogRepository.listDormitories.mockResolvedValue([]);

    await expect(query.getDormitories('SAMCHEOK', 'M')).resolves.toEqual({
      campus: {
        code: 'SAMCHEOK',
        nameKo: '삼척캠퍼스',
        isOperated: false,
      },
      items: [],
    });
    expect(dormitoryCatalogRepository.listDormitories).toHaveBeenCalledWith('SAMCHEOK', 'M');
  });

  it('master directory는 시즌 운영 여부와 무관하게 캠퍼스 기준 건물 master를 반환한다', async () => {
    dormitoryCatalogRepository.findCampus.mockResolvedValue({
      code: 'CHUNCHEON',
      nameKo: '춘천캠퍼스',
      isOperated: true,
    });
    dormitoryCatalogRepository.listDormitories.mockResolvedValue([
      { id: 'dasan', nameKo: '다산관', roomType: 2, genderPolicy: 'M' },
      { id: 'toegye', nameKo: '퇴계관', roomType: 3, genderPolicy: 'M' },
      { id: 'saerom', nameKo: '새롬관', roomType: 2, genderPolicy: 'BOTH' },
    ]);

    const result = await query.getDormitories('CHUNCHEON', 'M');
    expect(result.items).toEqual([
      { id: 'dasan', name: '다산관', roomType: 2, genderPolicy: 'M', isOperated: true },
      { id: 'toegye', name: '퇴계관', roomType: 3, genderPolicy: 'M', isOperated: true },
      { id: 'saerom', name: '새롬관', roomType: 2, genderPolicy: 'BOTH', isOperated: true },
    ]);
  });

  it('detail은 campus meta를 포함한 dormitory catalog item을 반환한다', async () => {
    dormitoryCatalogRepository.findDormitoryDetail.mockResolvedValue({
      id: 'dasan',
      nameKo: '다산관',
      roomType: 2,
      genderPolicy: 'M',
      campus: {
        code: 'CHUNCHEON',
        nameKo: '춘천캠퍼스',
        isOperated: true,
      },
    });

    await expect(query.getDormitoryById('dasan')).resolves.toEqual({
      id: 'dasan',
      campusCode: 'CHUNCHEON',
      campusNameKo: '춘천캠퍼스',
      name: '다산관',
      roomType: 2,
      genderPolicy: 'M',
      isOperated: true,
    });
  });
});
