import { describe, expect, it } from 'vitest';
import { toProfileUserProfile } from '../profile-user.mapper';

const lifestyle = {
  bedtime: null,
  wakeTime: null,
  sleepHabit: null,
  sleepEnvironment: null,
  screenUsage: null,
  noiseSensitivity: null,
  smokingBehavior: null,
  indoorEating: null,
  phoneBehavior: null,
  earphoneUsage: null,
  cleanLevel: null,
  drinkingFrequency: null,
  relationshipStyle: null,
  temperatureSensitivity: null,
  smokingTolerance: null,
  phoneTolerance: null,
  earphoneExpectation: null,
  sleepEnvPreference: null,
  screenTolerance: null,
  indoorEatingTolerance: null,
  cleanExpectation: null,
  drinkingTolerance: null,
} as const;

describe('toProfileUserProfile', () => {
  it('profile owner source의 lifestyle/intro/dormitory를 보존해 UserProfile view model을 만든다', () => {
    expect(
      toProfileUserProfile({
        id: 'user-1',
        nickname: '프로필유저',
        gender: 'F',
        campus: 'CHUNCHEON',
        dormitoryId: 'saerom',
        lifestyle,
        intro: '프로필 API 소개',
        messageToRoommate: '잘 부탁해요',
        additional: { college: 'IT', grade: '2', mbti: 'ENFP', birthYear: 2004 },
      }),
    ).toEqual({
      id: 'user-1',
      nickname: '프로필유저',
      gender: 'F',
      campus: 'CHUNCHEON',
      dormitoryId: 'saerom',
      lifestyle,
      intro: '프로필 API 소개',
      messageToRoommate: '잘 부탁해요',
      additional: { college: 'IT', grade: '2', mbti: 'ENFP', birthYear: 2004 },
    });
  });

  it('mock profile source에 없는 optional view fields만 fallback한다', () => {
    const result = toProfileUserProfile({
      id: 'user-2',
      nickname: '선택필드없음',
      gender: 'M',
      campus: 'SAMCHEOK',
      dormitoryId: null,
      lifestyle,
      intro: '',
    });

    expect(result.messageToRoommate).toBeNull();
    expect(result.additional).toEqual({ college: null, grade: null, mbti: null, birthYear: null });
  });
});
