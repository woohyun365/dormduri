import type { LifestyleData } from '@/types/lifestyle';
import type { UserProfile, RoommateProfile } from '@/types/profile';
import type { MatchRequest, ActiveMatch } from '@/types/match';
import type { AdditionalProfile } from '@/types/additional-profile';

// -- Defaults --

const DEFAULT_LIFESTYLE: LifestyleData = {
  smoker: 'NO',
  sleepHabit: 'NONE',
  indoorEating: 'OK',
  bedtime: '22_24',
  wakeTime: '06_08',
  noiseSensitivity: 'MID',
  cleanliness: 'MID',
  relationshipStyle: 'CASUAL',
};

const DEFAULT_ADDITIONAL: AdditionalProfile = {
  college: null,
  grade: null,
  mbti: null,
  temperatureSensitivity: null,
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
    nickname: '테스트유저',
    gender: 'M',
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
  smoker: 'YES',
  sleepHabit: 'SNORING',
  indoorEating: 'NO',
  bedtime: 'AFTER_02',
  wakeTime: 'AFTER_10',
  noiseSensitivity: 'LOW',
  cleanliness: 'LOW',
  relationshipStyle: 'CLOSE',
});

/** 모든 필드가 null (회원가입 직후) */
export const LIFESTYLE_EMPTY: LifestyleData = {
  smoker: null,
  sleepHabit: null,
  indoorEating: null,
  bedtime: null,
  wakeTime: null,
  noiseSensitivity: null,
  cleanliness: null,
  relationshipStyle: null,
};
