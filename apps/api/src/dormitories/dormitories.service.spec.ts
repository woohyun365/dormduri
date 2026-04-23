import { DormitoriesService } from './dormitories.service.js';

describe('DormitoriesService', () => {
  const prisma = {
    campusMaster: {
      findUnique: jest.fn(),
    },
    dormitory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const dormitorySelectableQueryService = {
    getSelectableDormitories: jest.fn(),
  };

  const service = new DormitoriesService(prisma as never, dormitorySelectableQueryService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('비운영 캠퍼스는 campus meta와 빈 items를 반환한다', async () => {
    prisma.campusMaster.findUnique.mockResolvedValue({
      code: 'SAMCHEOK',
      nameKo: '삼척캠퍼스',
      isOperated: false,
    });
    prisma.dormitory.findMany.mockResolvedValue([]);

    await expect(service.getDormitories('SAMCHEOK', 'M')).resolves.toEqual({
      campus: {
        code: 'SAMCHEOK',
        nameKo: '삼척캠퍼스',
        isOperated: false,
      },
      items: [],
    });
  });

  it('master directory는 시즌 운영 여부와 무관하게 캠퍼스 기준 건물 master를 반환한다', async () => {
    prisma.campusMaster.findUnique.mockResolvedValue({
      code: 'CHUNCHEON',
      nameKo: '춘천캠퍼스',
      isOperated: true,
    });
    prisma.dormitory.findMany.mockResolvedValue([
      { id: 'dasan', nameKo: '다산관', roomType: 2, genderPolicy: 'M' },
      { id: 'toegye', nameKo: '퇴계관', roomType: 3, genderPolicy: 'M' },
      { id: 'saerom', nameKo: '새롬관', roomType: 2, genderPolicy: 'BOTH' },
    ]);

    const result = await service.getDormitories('CHUNCHEON', 'M');
    expect(result.items).toEqual([
      { id: 'dasan', name: '다산관', roomType: 2, genderPolicy: 'M', isOperated: true },
      { id: 'toegye', name: '퇴계관', roomType: 3, genderPolicy: 'M', isOperated: true },
      { id: 'saerom', name: '새롬관', roomType: 2, genderPolicy: 'BOTH', isOperated: true },
    ]);
  });

  it('selectable 목록 조회는 SeasonDormitoryOperation 중심 query service에 위임한다', async () => {
    dormitorySelectableQueryService.getSelectableDormitories.mockResolvedValue({
      campus: {
        code: 'CHUNCHEON',
        nameKo: '춘천캠퍼스',
        isOperated: true,
      },
      items: [{ id: 'dasan', name: '다산관', roomType: 2, genderPolicy: 'M', isOperated: true }],
    });

    await expect(service.getSelectableDormitories('CHUNCHEON', 'M')).resolves.toEqual({
      campus: {
        code: 'CHUNCHEON',
        nameKo: '춘천캠퍼스',
        isOperated: true,
      },
      items: [{ id: 'dasan', name: '다산관', roomType: 2, genderPolicy: 'M', isOperated: true }],
    });
    expect(dormitorySelectableQueryService.getSelectableDormitories).toHaveBeenCalledWith(
      'CHUNCHEON',
      'M',
    );
  });

  it('건물 guide 응답에 공통 규칙과 연락처를 포함한다', async () => {
    prisma.dormitory.findUnique.mockResolvedValue({
      id: 'dasan',
      nameKo: '다산관',
      roomType: 2,
      campus: {
        guideContent: {
          commonRules: [{ emoji: '🕐', label: '통금', value: '01:00 ~ 05:00' }],
          emergencyContacts: [{ label: '야간·공휴일 콜센터', value: '033-250-8067' }],
          homepageUrl: 'https://knudorm.kangwon.ac.kr/index.knu',
        },
      },
      guide: {
        bathroomType: 'SHARED',
        facilities: ['세탁실'],
        repairContact: '033-250-8063',
        diningContact: null,
      },
    });

    const result = await service.getDormitoryGuide('dasan');
    expect(result.dormitory.name).toBe('다산관');
    expect(result.commonRules.length).toBeGreaterThan(0);
    expect(result.emergencyContacts.length).toBeGreaterThan(0);
  });

  it('guide payload가 schema와 맞지 않으면 즉시 실패한다', async () => {
    prisma.dormitory.findUnique.mockResolvedValue({
      id: 'dasan',
      nameKo: '다산관',
      roomType: 2,
      campus: {
        guideContent: {
          commonRules: [{ emoji: '🕐', label: '통금', value: '01:00 ~ 05:00' }],
          emergencyContacts: [{ label: '야간·공휴일 콜센터', value: '033-250-8067' }],
          homepageUrl: 'invalid-url',
        },
      },
      guide: {
        bathroomType: 'SHARED',
        facilities: ['세탁실'],
        repairContact: '033-250-8063',
        diningContact: null,
      },
    });

    await expect(service.getDormitoryGuide('dasan')).rejects.toThrow();
  });
});
