import type { UserProfile } from '@/types/profile';

const MOCK_USERS: Record<'male' | 'female', UserProfile> = {
  male: {
    nickname: '곰두리',
    gender: 'M',
    dormitoryId: null,
    lifestyle: {
      smoker: 'NO',
      sleepHabit: 'NONE',
      indoorEating: 'OK',
      bedtime: '22_24',
      wakeTime: '06_08',
      noiseSensitivity: 'MID',
      cleanliness: 'HIGH',
      relationshipStyle: 'CLOSE',
    },
    intro: '조용하고 규칙적인 생활을 선호합니다. 서로 존중하며 지낼 룸메이트를 찾습니다.',
    messageToRoommate: null,
    additional: {
      college: null,
      grade: null,
      mbti: null,
      temperatureSensitivity: null,
    },
  },
  female: {
    nickname: '봄이',
    gender: 'F',
    dormitoryId: null,
    lifestyle: {
      smoker: 'NO',
      sleepHabit: 'NONE',
      indoorEating: 'NO',
      bedtime: '24_02',
      wakeTime: '08_10',
      noiseSensitivity: 'HIGH',
      cleanliness: 'HIGH',
      relationshipStyle: 'CASUAL',
    },
    intro: '깔끔하고 밝은 분위기를 좋아해요. 서로 배려하며 편하게 지내고 싶습니다.',
    messageToRoommate: null,
    additional: {
      college: null,
      grade: null,
      mbti: null,
      temperatureSensitivity: null,
    },
  },
};

/**
 * development 전용: localStorage 기반 mock 유저 반환
 *
 * - dev-gender: 'M' | 'F' (기본 'M')
 * - dev-dormitory: dormitoryId (빈 문자열이면 null → 건물 선택 모달 표시)
 */
export function getMockUser(genderParam?: string | null): UserProfile {
  const key = genderParam === 'F' ? 'female' : 'male';
  const user = { ...MOCK_USERS[key] };

  // DevPanel에서 설정한 건물 반영
  if (typeof window !== 'undefined') {
    const dormitory = localStorage.getItem('dev-dormitory');
    if (dormitory) {
      user.dormitoryId = dormitory;
    }
  }

  return user;
}
