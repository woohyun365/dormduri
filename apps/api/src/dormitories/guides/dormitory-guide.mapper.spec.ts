import { describe, expect, it } from 'vitest';
import { mapDormitoryGuideResponse } from './dormitory-guide.mapper.js';

describe('dormitory-guide.mapper', () => {
  it('campus guide content와 dormitory guide를 canonical response로 변환한다', () => {
    const result = mapDormitoryGuideResponse({
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

    expect(result).toEqual({
      dormitory: {
        id: 'dasan',
        name: '다산관',
        roomType: 2,
      },
      guide: {
        bathroomType: 'SHARED',
        facilities: ['세탁실'],
        repairContact: '033-250-8063',
        diningContact: null,
      },
      commonRules: [{ emoji: '🕐', label: '통금', value: '01:00 ~ 05:00' }],
      emergencyContacts: [{ label: '야간·공휴일 콜센터', value: '033-250-8067' }],
      homepageUrl: 'https://knudorm.kangwon.ac.kr/index.knu',
    });
  });
});
