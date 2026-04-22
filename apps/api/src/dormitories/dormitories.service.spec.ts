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
  const seasonsService = {
    getCurrentSeasonContext: jest.fn(),
  };

  const service = new DormitoriesService(prisma as never, seasonsService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('비운영 캠퍼스는 campus meta와 빈 items를 반환한다', async () => {
    prisma.campusMaster.findUnique.mockResolvedValue({
      code: 'SAMCHEOK',
      nameKo: '삼척캠퍼스',
      isOperated: false,
    });
    seasonsService.getCurrentSeasonContext.mockResolvedValue(null);
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

  it('운영 캠퍼스 목록은 성별과 공용 건물을 함께 반환한다', async () => {
    prisma.campusMaster.findUnique.mockResolvedValue({
      code: 'CHUNCHEON',
      nameKo: '춘천캠퍼스',
      isOperated: true,
    });
    seasonsService.getCurrentSeasonContext.mockResolvedValue({
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
        { dormitoryId: 'saerom', isOperated: true, roomSelectionDate: '2026-02-11' },
      ],
    });
    prisma.dormitory.findMany.mockResolvedValue([
      { id: 'dasan', nameKo: '다산관', roomType: 2, genderPolicy: 'M' },
      { id: 'saerom', nameKo: '새롬관', roomType: 2, genderPolicy: 'BOTH' },
    ]);

    const result = await service.getDormitories('CHUNCHEON', 'M');
    expect(result.items).toEqual([
      { id: 'dasan', name: '다산관', roomType: 2, genderPolicy: 'M', isOperated: true },
      { id: 'saerom', name: '새롬관', roomType: 2, genderPolicy: 'BOTH', isOperated: true },
    ]);
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
});
