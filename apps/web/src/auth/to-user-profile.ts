import type { LifestyleData } from '@/types/lifestyle';
import type { UserProfile } from '@/types/profile';

type UserProfileSource = {
  id: string;
  nickname: string;
  gender: 'M' | 'F';
  campus: UserProfile['campus'];
  dormitoryId?: string | null;
  lifestyle?: LifestyleData;
  intro?: string;
  messageToRoommate?: string | null;
  additional?: UserProfile['additional'];
};

const EMPTY_LIFESTYLE: LifestyleData = {
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
};

const EMPTY_ADDITIONAL: UserProfile['additional'] = {
  college: null,
  grade: null,
  mbti: null,
  birthYear: null,
};

export function toUserProfile(source: UserProfileSource): UserProfile {
  return {
    id: source.id,
    nickname: source.nickname,
    gender: source.gender,
    campus: source.campus,
    dormitoryId: source.dormitoryId ?? null,
    lifestyle: source.lifestyle ?? EMPTY_LIFESTYLE,
    intro: source.intro ?? '',
    messageToRoommate: source.messageToRoommate ?? null,
    additional: source.additional ?? EMPTY_ADDITIONAL,
  };
}
