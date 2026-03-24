import type { LifestyleData } from '@/types/lifestyle';
import type { UserProfile, RoommateProfile } from '@/types/profile';
import type { MatchRequest, ActiveMatch } from '@/types/match';
import type { AdditionalProfile } from '@/types/additional-profile';

// -- Defaults --

const DEFAULT_LIFESTYLE: LifestyleData = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'NORMAL',
  smokingBehavior: 'NO',
  indoorEating: 'SNACK',
  phoneBehavior: 'SOMETIMES',
  earphoneUsage: 'MOSTLY',
  cleanLevel: 'WEEKLY_1_2',
  drinkingFrequency: 'SOMETIMES',
  relationshipStyle: 'CASUAL',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'E_CIG_OK',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'STUDY',
  sleepEnvPreference: 'SPEAKER_OK',
  screenTolerance: 'NO_SCREEN',
  indoorEatingTolerance: 'CLEAN_OK',
  cleanExpectation: 'BASIC',
  drinkingTolerance: 'LOW_ONLY',
};

const DEFAULT_ADDITIONAL: AdditionalProfile = {
  college: null,
  grade: null,
  mbti: null,
  birthYear: null,
};

// -- Factory Functions --

export function makeLifestyle(overrides: Partial<LifestyleData> = {}): LifestyleData {
  return { ...DEFAULT_LIFESTYLE, ...overrides };
}

export function makeAdditional(overrides: Partial<AdditionalProfile> = {}): AdditionalProfile {
  return { ...DEFAULT_ADDITIONAL, ...overrides };
}

export function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'test-user-0001',
    nickname: '테스트유저',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'dasan',
    lifestyle: DEFAULT_LIFESTYLE,
    intro: '테스트 자기소개입니다.',
    messageToRoommate: null,
    additional: DEFAULT_ADDITIONAL,
    ...overrides,
    // nested objects: override 내부에 lifestyle/additional이 있으면 병합
    ...(overrides.lifestyle && { lifestyle: makeLifestyle(overrides.lifestyle) }),
    ...(overrides.additional && { additional: makeAdditional(overrides.additional) }),
  };
}

let roommateIdCounter = 1;

export function makeRoommateProfile(
  overrides: Partial<Omit<RoommateProfile, 'matchScore'>> & { matchScore?: number } = {},
): RoommateProfile {
  const id = overrides.id ?? String(roommateIdCounter++);
  return {
    id,
    nickname: `룸메${id}`,
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'dasan',
    lifestyle: DEFAULT_LIFESTYLE,
    intro: '테스트 룸메이트입니다.',
    messageToRoommate: null,
    additional: DEFAULT_ADDITIONAL,
    matchScore: 50,
    ...overrides,
    ...(overrides.lifestyle && { lifestyle: makeLifestyle(overrides.lifestyle) }),
    ...(overrides.additional && { additional: makeAdditional(overrides.additional) }),
  };
}

/** 테스트 간 roommateIdCounter 초기화 */
export function resetRoommateIdCounter(): void {
  roommateIdCounter = 1;
}

const NOW = new Date('2026-03-01T12:00:00Z').getTime();

export function makeMatchRequest(overrides: Partial<MatchRequest> = {}): MatchRequest {
  return {
    id: 'req-1',
    fromUserId: 'me',
    toUserId: 'target',
    status: 'PENDING',
    message: null,
    createdAt: new Date(NOW - 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(NOW + 24 * 60 * 60 * 1000).toISOString(),
    rejectedAt: null,
    ...overrides,
  };
}

export function makeActiveMatch(overrides: Partial<ActiveMatch> = {}): ActiveMatch {
  return {
    matchId: 'match-1',
    partnerUserId: 'partner',
    partnerNickname: '룸메이트',
    partnerDormitoryId: 'dasan',
    matchScore: 75,
    matchedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

// -- Lifestyle Presets --

/** 모든 필드가 동일한 두 세트 (100점 나와야 함) */
export const LIFESTYLE_IDENTICAL = makeLifestyle();

/** 정반대 라이프스타일 */
export const LIFESTYLE_OPPOSITE = makeLifestyle({
  bedtime: 'AFTER_02',
  wakeTime: 'AFTER_10',
  sleepHabit: 'SNORING',
  sleepEnvironment: 'LOW_SPEAKER',
  noiseSensitivity: 'SENSITIVE',
  smokingBehavior: 'YES',
  indoorEating: 'MEAL',
  phoneBehavior: 'OFTEN',
  earphoneUsage: 'ALWAYS_SPEAKER',
  cleanLevel: 'WHEN_DIRTY',
  drinkingFrequency: 'OFTEN',
  relationshipStyle: 'CLOSE',
  temperatureSensitivity: 'HOT',
  smokingTolerance: 'NO_ONLY',
  phoneTolerance: 'OUTSIDE_ONLY',
  earphoneExpectation: 'MUST',
  sleepEnvPreference: 'NO_SPEAKER',
  indoorEatingTolerance: 'NO_SMELL',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
});

/** 모든 필드가 null (회원가입 직후) */
export const LIFESTYLE_EMPTY: LifestyleData = {
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
