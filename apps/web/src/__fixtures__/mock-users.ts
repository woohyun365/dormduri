import type { MockUser } from './mock-db';

/**
 * DevPanel 전용 프리셋 유저
 *
 * 룸메 후보 목록(profiles.ts)에는 포함되지 않는다.
 * DevPanel에서 빠른 로그인 전환용으로만 사용한다.
 */
export const PRESET_USERS: Record<'male' | 'female', MockUser> = {
  male: {
    id: 'preset-male-0001',
    email: 'gomduri@kangwon.ac.kr',
    password: 'preset',
    nickname: '곰두리',
    gender: 'M',
    campus: 'CHUNCHEON',
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
  },
  female: {
    id: 'preset-female-0001',
    email: 'bomi@kangwon.ac.kr',
    password: 'preset',
    nickname: '봄이',
    gender: 'F',
    campus: 'CHUNCHEON',
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
  },
};
