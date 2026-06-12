import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DormitoryGuideQuery } from './dormitory-guide.query.js';

describe('DormitoryGuideQuery', () => {
  const prisma = {
    dormitory: {
      findUnique: vi.fn(),
    },
  };
  const query = new DormitoryGuideQuery(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
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

    const result = await query.getDormitoryGuide('dasan');
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

    await expect(query.getDormitoryGuide('dasan')).rejects.toThrow();
  });
});
