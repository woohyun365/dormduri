/**
 * 시드 기반 fixture 프로필 생성기
 *
 * - 시드 고정 → 항상 동일한 프로필 생성 (테스트 재현성)
 * - 건물별 비율/혼성 건물 남녀 비율 조정 가능
 */
import type { LifestyleData } from '@/types/lifestyle';
import type { RoommateProfile } from '@/types/profile';
import type { AdditionalProfile } from '@/types/additional-profile';
import { DORMITORIES } from '@/constants/dormitory';

// -- Seeded PRNG (mulberry32) --

function mulberry32(seed: number) {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

// -- Nickname pool --

const ADJECTIVES = [
  '조용한',
  '활발한',
  '부지런한',
  '느긋한',
  '깔끔한',
  '다정한',
  '씩씩한',
  '유쾌한',
  '차분한',
  '명랑한',
  '신중한',
  '용감한',
  '소심한',
  '담백한',
  '따뜻한',
  '쿨한',
  '솔직한',
  '순수한',
  '자유로운',
  '성실한',
] as const;

const NOUNS = [
  '고양이',
  '강아지',
  '펭귄',
  '다람쥐',
  '올빼미',
  '토끼',
  '여우',
  '곰돌이',
  '햄스터',
  '판다',
  '사슴',
  '수달',
  '참새',
  '고래',
  '돌고래',
  '코알라',
  '카피바라',
  '알파카',
  '부엉이',
  '호랑이',
] as const;

// -- Lifestyle value pools --

const BEDTIME_VALUES: LifestyleData['bedtime'][] = ['BEFORE_22', '22_24', '24_02', 'AFTER_02'];
const WAKE_VALUES: LifestyleData['wakeTime'][] = [
  'BEFORE_07',
  '07_08',
  '08_09',
  '09_10',
  'AFTER_10',
  'FLEXIBLE',
];
const SLEEP_HABIT_VALUES: LifestyleData['sleepHabit'][] = [
  'NONE',
  'NONE',
  'NONE',
  'TALKING',
  'SNORING',
  'GRINDING',
];
const SLEEP_ENV_VALUES: LifestyleData['sleepEnvironment'][] = ['QUIET', 'EARPHONE', 'LOW_SPEAKER'];
const NOISE_VALUES: LifestyleData['noiseSensitivity'][] = ['SENSITIVE', 'NORMAL', 'DEEP'];

const SMOKING_VALUES: LifestyleData['smokingBehavior'][] = ['NO', 'NO', 'NO', 'NO', 'E_CIG', 'YES'];
const INDOOR_EATING_VALUES: LifestyleData['indoorEating'][] = ['NO', 'OK', 'VENTILATE'];
const PHONE_VALUES: LifestyleData['phoneBehavior'][] = ['OUTSIDE', 'BRIEF', 'FREE'];
const EARPHONE_VALUES: LifestyleData['earphoneUsage'][] = ['ALWAYS', 'STUDY', 'QUIET', 'FREE'];
const CLEAN_VALUES: LifestyleData['cleanLevel'][] = ['WHEN_DIRTY', 'WEEKLY_1_2', 'WEEKLY_3_UP'];
const DRINKING_VALUES: LifestyleData['drinkingFrequency'][] = ['NONE', 'SOMETIMES', 'OFTEN'];
const RELATION_VALUES: LifestyleData['relationshipStyle'][] = ['CLOSE', 'CASUAL'];
const TEMP_VALUES: LifestyleData['temperatureSensitivity'][] = ['COLD', 'NORMAL', 'HOT'];

const SMOKING_TOL_VALUES: LifestyleData['smokingTolerance'][] = ['NO_ONLY', 'E_CIG_OK', 'ANY'];
const PHONE_TOL_VALUES: LifestyleData['phoneTolerance'][] = ['OUTSIDE_ONLY', 'BRIEF_OK', 'ANY'];
const EARPHONE_EXP_VALUES: LifestyleData['earphoneExpectation'][] = ['MUST', 'STUDY', 'ANY'];
const SLEEP_ENV_PREF_VALUES: LifestyleData['sleepEnvPreference'][] = [
  'QUIET_ONLY',
  'EARPHONE_OK',
  'LOW_SPEAKER_OK',
];
const CLEAN_EXP_VALUES: LifestyleData['cleanExpectation'][] = ['STRICT', 'BASIC', 'FLEXIBLE'];
const DRINKING_TOL_VALUES: LifestyleData['drinkingTolerance'][] = [
  'NONE_ONLY',
  'SOMETIMES_OK',
  'ANY',
];
const COLLEGES: AdditionalProfile['college'][] = [
  'IT대',
  '경영대',
  '사범대',
  '인문대',
  '농업생명대',
  '자연과학대',
  '문화예술·공대',
  '사회과학대',
  '산림환경대',
  null,
];
const GRADES: AdditionalProfile['grade'][] = ['1', '2', '3', '4+', null];
const BIRTH_YEARS: AdditionalProfile['birthYear'][] = [2000, 2001, 2002, 2003, 2004, null];

const INTROS = [
  '편하게 지내실 분 구해요.',
  '서로 배려하며 지내요!',
  '각자 생활 존중합니다.',
  '조용한 환경을 선호해요.',
  '같이 밥 먹을 룸메 찾아요.',
  '깨끗한 환경을 좋아합니다.',
  '소통하면서 지내고 싶어요.',
  '기숙사 처음인데 잘 부탁해요.',
  '규칙적인 생활을 합니다.',
  '편안한 분위기를 좋아해요.',
];

// -- Config types --

export interface BuildingAllocation {
  dormitoryId: string;
  ratio: number;
  /** BOTH 건물 전용: 남성 비율 (0~1), 기본 0.5 */
  maleRatio?: number;
}

export interface GeneratorConfig {
  seed: number;
  total: number;
  buildings: BuildingAllocation[];
}

// -- Default config --

export const DEFAULT_CONFIG: GeneratorConfig = {
  seed: 42,
  total: 50,
  buildings: [
    { dormitoryId: 'saerom', ratio: 0.2, maleRatio: 0.6 },
    { dormitoryId: 'irum', ratio: 0.15, maleRatio: 0.5 },
    { dormitoryId: 'daon', ratio: 0.15, maleRatio: 0.5 },
    { dormitoryId: 'dasan', ratio: 0.1 },
    { dormitoryId: 'toegye', ratio: 0.1 },
    { dormitoryId: 'yeji', ratio: 0.1 },
    { dormitoryId: 'nanji', ratio: 0.08 },
    { dormitoryId: 'gukji', ratio: 0.08 },
    // 나머지 4%는 미배정
  ],
};

// -- Generator --

function generateLifestyle(rng: () => number): LifestyleData {
  return {
    bedtime: pick(rng, BEDTIME_VALUES),
    wakeTime: pick(rng, WAKE_VALUES),
    sleepHabit: pick(rng, SLEEP_HABIT_VALUES),
    sleepEnvironment: pick(rng, SLEEP_ENV_VALUES),
    noiseSensitivity: pick(rng, NOISE_VALUES),
    smokingBehavior: pick(rng, SMOKING_VALUES),
    indoorEating: pick(rng, INDOOR_EATING_VALUES),
    phoneBehavior: pick(rng, PHONE_VALUES),
    earphoneUsage: pick(rng, EARPHONE_VALUES),
    cleanLevel: pick(rng, CLEAN_VALUES),
    drinkingFrequency: pick(rng, DRINKING_VALUES),
    relationshipStyle: pick(rng, RELATION_VALUES),
    temperatureSensitivity: pick(rng, TEMP_VALUES),
    smokingTolerance: pick(rng, SMOKING_TOL_VALUES),
    phoneTolerance: pick(rng, PHONE_TOL_VALUES),
    earphoneExpectation: pick(rng, EARPHONE_EXP_VALUES),
    sleepEnvPreference: pick(rng, SLEEP_ENV_PREF_VALUES),
    cleanExpectation: pick(rng, CLEAN_EXP_VALUES),
    drinkingTolerance: pick(rng, DRINKING_TOL_VALUES),
  };
}

function generateAdditional(rng: () => number): AdditionalProfile {
  const mbtis = [
    'ISTJ',
    'ISFJ',
    'INFJ',
    'INTJ',
    'ISTP',
    'ISFP',
    'INFP',
    'INTP',
    'ESTP',
    'ESFP',
    'ENFP',
    'ENTP',
    'ESTJ',
    'ESFJ',
    'ENFJ',
    'ENTJ',
  ];
  return {
    college: pick(rng, COLLEGES),
    grade: pick(rng, GRADES),
    mbti: rng() > 0.3 ? pick(rng, mbtis) : null,
    birthYear: pick(rng, BIRTH_YEARS),
  };
}

function generateNickname(rng: () => number, usedNames: Set<string>): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const name = pick(rng, ADJECTIVES) + pick(rng, NOUNS);
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  // fallback: 숫자 접미사
  const base = pick(rng, ADJECTIVES) + pick(rng, NOUNS);
  const fallback = `${base}${usedNames.size}`;
  usedNames.add(fallback);
  return fallback;
}

export function generateProfiles(
  config: GeneratorConfig = DEFAULT_CONFIG,
): Omit<RoommateProfile, 'matchScore'>[] {
  const rng = mulberry32(config.seed);
  const usedNames = new Set<string>();
  const profiles: Omit<RoommateProfile, 'matchScore'>[] = [];

  const dormMap = new Map(DORMITORIES.map((d) => [d.id, d]));

  // 건물별 인원 계산
  type Slot = { dormitoryId: string; gender: 'M' | 'F' };
  const slots: Slot[] = [];

  for (const alloc of config.buildings) {
    const count = Math.round(config.total * alloc.ratio);
    const dorm = dormMap.get(alloc.dormitoryId);

    for (let i = 0; i < count; i++) {
      let gender: 'M' | 'F';
      if (dorm?.gender === 'M') {
        gender = 'M';
      } else if (dorm?.gender === 'F') {
        gender = 'F';
      } else {
        gender = rng() < (alloc.maleRatio ?? 0.5) ? 'M' : 'F';
      }
      slots.push({ dormitoryId: alloc.dormitoryId, gender });
    }
  }

  // 반올림 누적으로 total 초과 시 캡핑
  if (slots.length > config.total) {
    slots.length = config.total;
  }

  // 나머지를 미배정으로 채움
  const remaining = config.total - slots.length;
  for (let i = 0; i < remaining; i++) {
    slots.push({ dormitoryId: '', gender: rng() < 0.5 ? 'M' : 'F' });
  }

  // 프로필 생성
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    const hasMessage = rng() > 0.5;

    profiles.push({
      id: `gen-${i + 1}`,
      nickname: generateNickname(rng, usedNames),
      gender: slot.gender,
      dormitoryId: slot.dormitoryId || null,
      lifestyle: generateLifestyle(rng),
      intro: pick(rng, INTROS),
      messageToRoommate: hasMessage ? '잘 지내봐요!' : null,
      additional: generateAdditional(rng),
    });
  }

  return profiles;
}
