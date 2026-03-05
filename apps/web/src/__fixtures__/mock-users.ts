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
 * development 전용: URL 쿼리 기반 mock 유저 반환
 * /main?gender=F → 여자 프로필, 기본값 남자
 */
export function getMockUser(genderParam?: string | null): UserProfile {
  const key = genderParam === 'F' ? 'female' : 'male';
  return { ...MOCK_USERS[key] };
}
