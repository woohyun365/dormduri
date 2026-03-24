import { describe, it, expect } from 'vitest';
import { calcMatchScore, calcMatchScoreWithGating } from '../matchScore';
import type { LifestyleData } from '@/types/lifestyle';

// -- Helper: 22필드 전부 null인 빈 LifestyleData --

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

/** 특정 필드만 override하여 LifestyleData 생성 */
function make(overrides: Partial<LifestyleData> = {}): LifestyleData {
  return { ...EMPTY_LIFESTYLE, ...overrides };
}

/**
 * 13쌍 전체가 참여하는 "풀 프로필"
 * 모든 쌍에서 1.0 (만점)이 되는 조합
 */
const FULL_PERFECT_A: LifestyleData = {
  // 수면 패턴
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'SENSITIVE',
  // 생활 패턴
  smokingBehavior: 'NO',
  indoorEating: 'RARELY',
  phoneBehavior: 'RARELY',
  earphoneUsage: 'ALWAYS',
  cleanLevel: 'WEEKLY_3_UP',
  drinkingFrequency: 'NONE',
  relationshipStyle: 'CLOSE',
  temperatureSensitivity: 'COLD',
  // 원하는 룸메 조건
  smokingTolerance: 'NO_ONLY',
  phoneTolerance: 'OUTSIDE_ONLY',
  earphoneExpectation: 'MUST',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'SCREEN_OK',
  indoorEatingTolerance: 'NO_SMELL',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
};

// B도 A의 조건을 완벽히 만족하고, A도 B의 조건을 완벽히 만족
const FULL_PERFECT_B: LifestyleData = { ...FULL_PERFECT_A };

describe('calcMatchScore', () => {
  // =========================================================
  // AC-N4: 13쌍 전체 참여, 가중치 합 35, 모두 1.0이면 100점
  // =========================================================
  describe('AC-N4: 전체 참여 시 만점', () => {
    it('13쌍 전체 참여, 모든 쌍 1.0이면 100점', () => {
      expect(calcMatchScore(FULL_PERFECT_A, FULL_PERFECT_B)).toBe(100);
    });

    it('자기 자신과 비교 → 100점', () => {
      expect(calcMatchScore(FULL_PERFECT_A, FULL_PERFECT_A)).toBe(100);
    });
  });

  // =========================================================
  // AC-N5: TYPE A 임계값 - smoking, drinking
  // =========================================================
  describe('AC-N5: TYPE A (Threshold)', () => {
    describe('Pair 1: smokingBehavior × smokingTolerance (T1=5)', () => {
      it('E_CIG vs E_CIG_OK → 1.0 (pass)', () => {
        const a = make({ smokingTolerance: 'E_CIG_OK', smokingBehavior: 'NO' });
        const b = make({ smokingBehavior: 'E_CIG', smokingTolerance: 'ANY' });
        // a evaluates b: E_CIG_OK vs E_CIG → 1.0
        // b evaluates a: ANY vs NO → 1.0
        // min(1.0, 1.0) → dynamicMax=10 (each side has 1 pair × weight 5)
        // Each side: (1.0×5)/5 × 100 = 100
        expect(calcMatchScore(a, b)).toBe(100);
      });

      it('E_CIG vs NO_ONLY → 0.0 (fail)', () => {
        const a = make({ smokingTolerance: 'NO_ONLY', smokingBehavior: 'NO' });
        const b = make({ smokingBehavior: 'E_CIG', smokingTolerance: 'ANY' });
        // a evaluates b: NO_ONLY vs E_CIG → 0.0
        // b evaluates a: ANY vs NO → 1.0
        // a perspective: (0.0×5)/5 × 100 = 0
        // b perspective: (1.0×5)/5 × 100 = 100
        // min(0, 100) = 0
        expect(calcMatchScore(a, b)).toBe(0);
      });

      it('YES vs ANY → 1.0', () => {
        const a = make({ smokingTolerance: 'ANY', smokingBehavior: 'YES' });
        const b = make({ smokingBehavior: 'YES', smokingTolerance: 'ANY' });
        expect(calcMatchScore(a, b)).toBe(100);
      });

      it('YES vs E_CIG_OK → 0.0', () => {
        const a = make({ smokingTolerance: 'E_CIG_OK', smokingBehavior: 'NO' });
        const b = make({ smokingBehavior: 'YES', smokingTolerance: 'ANY' });
        // a evaluates b: E_CIG_OK vs YES → 0.0
        expect(calcMatchScore(a, b)).toBe(0);
      });

      it('NO vs NO_ONLY → 1.0', () => {
        const a = make({ smokingTolerance: 'NO_ONLY', smokingBehavior: 'NO' });
        const b = make({ smokingBehavior: 'NO', smokingTolerance: 'NO_ONLY' });
        expect(calcMatchScore(a, b)).toBe(100);
      });
    });

    describe('Pair 2: drinkingFrequency × drinkingTolerance (T3=2)', () => {
      it('SOMETIMES vs ANY → 1.0', () => {
        const a = make({ drinkingTolerance: 'ANY', drinkingFrequency: 'NONE' });
        const b = make({ drinkingFrequency: 'SOMETIMES', drinkingTolerance: 'ANY' });
        expect(calcMatchScore(a, b)).toBe(100);
      });

      it('OFTEN vs LOW_ONLY → 0.0', () => {
        const a = make({ drinkingTolerance: 'LOW_ONLY', drinkingFrequency: 'NONE' });
        const b = make({ drinkingFrequency: 'OFTEN', drinkingTolerance: 'ANY' });
        // a evaluates b: LOW_ONLY vs OFTEN → 0.0
        expect(calcMatchScore(a, b)).toBe(0);
      });

      it('NONE vs LOW_ONLY → 1.0', () => {
        const a = make({ drinkingTolerance: 'LOW_ONLY', drinkingFrequency: 'NONE' });
        const b = make({ drinkingFrequency: 'NONE', drinkingTolerance: 'LOW_ONLY' });
        expect(calcMatchScore(a, b)).toBe(100);
      });
    });
  });

  // =========================================================
  // AC-N6: TYPE B 행렬 부분점수
  // =========================================================
  describe('AC-N6: TYPE B (Matrix) 부분점수', () => {
    describe('Pair 3: sleepHabit × noiseSensitivity (T1=5)', () => {
      it('SNORING × DEEP → 0.8', () => {
        const a = make({ noiseSensitivity: 'DEEP', sleepHabit: 'NONE' });
        const b = make({ sleepHabit: 'SNORING', noiseSensitivity: 'DEEP' });
        // a evaluates b: noiseSensitivity=DEEP, target sleepHabit=SNORING → 0.8
        // b evaluates a: noiseSensitivity=DEEP, target sleepHabit=NONE → 1.0
        // a perspective: (0.8×5)/5 × 100 = 80
        // b perspective: (1.0×5)/5 × 100 = 100
        // min(80, 100) = 80
        expect(calcMatchScore(a, b)).toBe(80);
      });

      it('TALKING × SENSITIVE → 0.3', () => {
        const a = make({ noiseSensitivity: 'SENSITIVE', sleepHabit: 'NONE' });
        const b = make({ sleepHabit: 'TALKING', noiseSensitivity: 'DEEP' });
        // a evaluates b: SENSITIVE vs TALKING → 0.3
        // b evaluates a: DEEP vs NONE → 1.0
        // a: (0.3×5)/5 × 100 = 30
        // b: (1.0×5)/5 × 100 = 100
        // min(30, 100) = 30
        expect(calcMatchScore(a, b)).toBe(30);
      });

      it('SNORING × SENSITIVE → 0.0', () => {
        const a = make({ noiseSensitivity: 'SENSITIVE', sleepHabit: 'NONE' });
        const b = make({ sleepHabit: 'SNORING', noiseSensitivity: 'DEEP' });
        // a evaluates b: SENSITIVE vs SNORING → 0.0
        expect(calcMatchScore(a, b)).toBe(0);
      });

      it('GRINDING × NORMAL → 0.5', () => {
        const a = make({ noiseSensitivity: 'NORMAL', sleepHabit: 'NONE' });
        const b = make({ sleepHabit: 'GRINDING', noiseSensitivity: 'DEEP' });
        // a evaluates b: NORMAL vs GRINDING → 0.5
        // b evaluates a: DEEP vs NONE → 1.0
        // min(50, 100) = 50
        expect(calcMatchScore(a, b)).toBe(50);
      });

      it('NONE × SENSITIVE → 1.0', () => {
        const a = make({ noiseSensitivity: 'SENSITIVE', sleepHabit: 'NONE' });
        const b = make({ sleepHabit: 'NONE', noiseSensitivity: 'SENSITIVE' });
        expect(calcMatchScore(a, b)).toBe(100);
      });

      it('TALKING × NORMAL → 0.8', () => {
        const a = make({ noiseSensitivity: 'NORMAL', sleepHabit: 'NONE' });
        const b = make({ sleepHabit: 'TALKING', noiseSensitivity: 'DEEP' });
        // a: NORMAL vs TALKING → 0.8; b: DEEP vs NONE → 1.0
        // min(80, 100) = 80
        expect(calcMatchScore(a, b)).toBe(80);
      });

      it('GRINDING × DEEP → 1.0', () => {
        const a = make({ noiseSensitivity: 'DEEP', sleepHabit: 'NONE' });
        const b = make({ sleepHabit: 'GRINDING', noiseSensitivity: 'DEEP' });
        // a: DEEP vs GRINDING → 1.0; b: DEEP vs NONE → 1.0
        expect(calcMatchScore(a, b)).toBe(100);
      });
    });

    describe('Pair 4: phoneBehavior × phoneTolerance (T2=3)', () => {
      it('SOMETIMES × OUTSIDE_ONLY → 0.0', () => {
        const a = make({ phoneTolerance: 'OUTSIDE_ONLY', phoneBehavior: 'RARELY' });
        const b = make({ phoneBehavior: 'SOMETIMES', phoneTolerance: 'ANY' });
        // a: OUTSIDE_ONLY vs SOMETIMES → 0.0
        // b: ANY vs RARELY → 1.0
        // a: (0.0×3)/3 × 100 = 0
        // min(0, 100) = 0
        expect(calcMatchScore(a, b)).toBe(0);
      });

      it('OFTEN × BRIEF_OK → 0.3', () => {
        const a = make({ phoneTolerance: 'BRIEF_OK', phoneBehavior: 'RARELY' });
        const b = make({ phoneBehavior: 'OFTEN', phoneTolerance: 'ANY' });
        // a: BRIEF_OK vs OFTEN → 0.3
        expect(calcMatchScore(a, b)).toBe(30);
      });

      it('OFTEN × OUTSIDE_ONLY → 0.0', () => {
        const a = make({ phoneTolerance: 'OUTSIDE_ONLY', phoneBehavior: 'RARELY' });
        const b = make({ phoneBehavior: 'OFTEN', phoneTolerance: 'ANY' });
        expect(calcMatchScore(a, b)).toBe(0);
      });

      it('OFTEN × ANY → 0.7', () => {
        const a = make({ phoneTolerance: 'ANY', phoneBehavior: 'RARELY' });
        const b = make({ phoneBehavior: 'OFTEN', phoneTolerance: 'ANY' });
        // a: ANY vs OFTEN → 0.7
        // b: ANY vs RARELY → 1.0
        // a: (0.7×3)/3 × 100 = 70
        // min(70, 100) = 70
        expect(calcMatchScore(a, b)).toBe(70);
      });
    });

    describe('Pair 5: earphoneUsage × earphoneExpectation (T2=3)', () => {
      it('MOSTLY × MUST → 0.7', () => {
        const a = make({ earphoneExpectation: 'MUST', earphoneUsage: 'ALWAYS' });
        const b = make({ earphoneUsage: 'MOSTLY', earphoneExpectation: 'ANY' });
        // a: MUST vs MOSTLY → 0.7
        // b: ANY vs ALWAYS → 1.0
        // a: (0.7×3)/3 × 100 = 70
        expect(calcMatchScore(a, b)).toBe(70);
      });

      it('MOSTLY_SPEAKER × STUDY → 0.7', () => {
        const a = make({ earphoneExpectation: 'STUDY', earphoneUsage: 'ALWAYS' });
        const b = make({ earphoneUsage: 'MOSTLY_SPEAKER', earphoneExpectation: 'ANY' });
        // a: STUDY vs MOSTLY_SPEAKER → 0.7
        expect(calcMatchScore(a, b)).toBe(70);
      });

      it('ALWAYS_SPEAKER × MUST → 0.0', () => {
        const a = make({ earphoneExpectation: 'MUST', earphoneUsage: 'ALWAYS' });
        const b = make({ earphoneUsage: 'ALWAYS_SPEAKER', earphoneExpectation: 'ANY' });
        expect(calcMatchScore(a, b)).toBe(0);
      });

      it('MOSTLY_SPEAKER × MUST → 0.0', () => {
        const a = make({ earphoneExpectation: 'MUST', earphoneUsage: 'ALWAYS' });
        const b = make({ earphoneUsage: 'MOSTLY_SPEAKER', earphoneExpectation: 'ANY' });
        expect(calcMatchScore(a, b)).toBe(0);
      });

      it('ALWAYS × MUST → 1.0', () => {
        const a = make({ earphoneExpectation: 'MUST', earphoneUsage: 'ALWAYS' });
        const b = make({ earphoneUsage: 'ALWAYS', earphoneExpectation: 'MUST' });
        expect(calcMatchScore(a, b)).toBe(100);
      });

      it('ALWAYS_SPEAKER × STUDY → 0.3', () => {
        const a = make({ earphoneExpectation: 'STUDY', earphoneUsage: 'ALWAYS' });
        const b = make({ earphoneUsage: 'ALWAYS_SPEAKER', earphoneExpectation: 'ANY' });
        // a: STUDY vs ALWAYS_SPEAKER → 0.3
        expect(calcMatchScore(a, b)).toBe(30);
      });
    });

    describe('Pair 6: sleepEnvironment × sleepEnvPreference (T2=3)', () => {
      it('LOW_SPEAKER × NO_SPEAKER → 0.0', () => {
        const a = make({ sleepEnvPreference: 'NO_SPEAKER', sleepEnvironment: 'QUIET' });
        const b = make({ sleepEnvironment: 'LOW_SPEAKER', sleepEnvPreference: 'SPEAKER_OK' });
        expect(calcMatchScore(a, b)).toBe(0);
      });

      it('QUIET × NO_SPEAKER → 1.0', () => {
        const a = make({ sleepEnvPreference: 'NO_SPEAKER', sleepEnvironment: 'QUIET' });
        const b = make({ sleepEnvironment: 'QUIET', sleepEnvPreference: 'NO_SPEAKER' });
        expect(calcMatchScore(a, b)).toBe(100);
      });

      it('LOW_SPEAKER × SPEAKER_OK → 1.0', () => {
        const a = make({ sleepEnvPreference: 'SPEAKER_OK', sleepEnvironment: 'LOW_SPEAKER' });
        const b = make({ sleepEnvironment: 'LOW_SPEAKER', sleepEnvPreference: 'SPEAKER_OK' });
        expect(calcMatchScore(a, b)).toBe(100);
      });
    });

    describe('Pair 7: cleanLevel × cleanExpectation (T3=2)', () => {
      it('WEEKLY_1_2 × STRICT → 0.3', () => {
        const a = make({ cleanExpectation: 'STRICT', cleanLevel: 'WEEKLY_3_UP' });
        const b = make({ cleanLevel: 'WEEKLY_1_2', cleanExpectation: 'FLEXIBLE' });
        // a: STRICT vs WEEKLY_1_2 → 0.3
        // b: FLEXIBLE vs WEEKLY_3_UP → 1.0
        // a: (0.3×2)/2 × 100 = 30
        expect(calcMatchScore(a, b)).toBe(30);
      });

      it('WHEN_DIRTY × BASIC → 0.3', () => {
        const a = make({ cleanExpectation: 'BASIC', cleanLevel: 'WEEKLY_3_UP' });
        const b = make({ cleanLevel: 'WHEN_DIRTY', cleanExpectation: 'FLEXIBLE' });
        // a: BASIC vs WHEN_DIRTY → 0.3
        expect(calcMatchScore(a, b)).toBe(30);
      });

      it('WHEN_DIRTY × STRICT → 0.0', () => {
        const a = make({ cleanExpectation: 'STRICT', cleanLevel: 'WEEKLY_3_UP' });
        const b = make({ cleanLevel: 'WHEN_DIRTY', cleanExpectation: 'FLEXIBLE' });
        expect(calcMatchScore(a, b)).toBe(0);
      });

      it('WEEKLY_3_UP × STRICT → 1.0', () => {
        const a = make({ cleanExpectation: 'STRICT', cleanLevel: 'WEEKLY_3_UP' });
        const b = make({ cleanLevel: 'WEEKLY_3_UP', cleanExpectation: 'STRICT' });
        expect(calcMatchScore(a, b)).toBe(100);
      });
    });
  });

  // =========================================================
  // AC-N7: TYPE C 거리 / TYPE D 일치
  // =========================================================
  describe('AC-N7: TYPE C (Distance) / TYPE D (Match)', () => {
    describe('Pair 8: bedtime (T3=2, 유사도)', () => {
      it('동일 → 1.0', () => {
        const a = make({ bedtime: '22_24' });
        const b = make({ bedtime: '22_24' });
        // (1.0×2)/2 × 100 = 100
        expect(calcMatchScore(a, b)).toBe(100);
      });

      it('인접 (|1-0|=1) → 0.67 → round((0.667×2)/2×100) = 67', () => {
        const a = make({ bedtime: 'BEFORE_22' });
        const b = make({ bedtime: '22_24' });
        // score = 1.0 - 1/3 = 0.6667
        // (0.6667×2)/2 × 100 = 66.67 → round → 67
        expect(calcMatchScore(a, b)).toBe(67);
      });

      it('2칸 차이 → 0.33 → 33', () => {
        const a = make({ bedtime: 'BEFORE_22' });
        const b = make({ bedtime: '24_02' });
        // score = 1.0 - 2/3 = 0.3333
        // round(33.33) = 33
        expect(calcMatchScore(a, b)).toBe(33);
      });

      it('최대 거리(3) → 0.0 → 0', () => {
        const a = make({ bedtime: 'BEFORE_22' });
        const b = make({ bedtime: 'AFTER_02' });
        // score = 1.0 - 3/3 = 0.0
        expect(calcMatchScore(a, b)).toBe(0);
      });
    });

    describe('Pair 9: wakeTime (T4=1, 유사도)', () => {
      it('동일 → 1.0', () => {
        const a = make({ wakeTime: '08_09' });
        const b = make({ wakeTime: '08_09' });
        expect(calcMatchScore(a, b)).toBe(100);
      });

      it('인접 → 0.75', () => {
        const a = make({ wakeTime: 'BEFORE_07' });
        const b = make({ wakeTime: '07_08' });
        // 1.0 - 1/4 = 0.75 → 75
        expect(calcMatchScore(a, b)).toBe(75);
      });

      it('최대 거리(4) → 0.0', () => {
        const a = make({ wakeTime: 'BEFORE_07' });
        const b = make({ wakeTime: 'AFTER_10' });
        expect(calcMatchScore(a, b)).toBe(0);
      });
    });

    describe('Pair 10: temperatureSensitivity (T2=3, 유사도)', () => {
      it('동일 → 1.0', () => {
        const a = make({ temperatureSensitivity: 'COLD' });
        const b = make({ temperatureSensitivity: 'COLD' });
        expect(calcMatchScore(a, b)).toBe(100);
      });

      it('인접 → 0.5', () => {
        const a = make({ temperatureSensitivity: 'COLD' });
        const b = make({ temperatureSensitivity: 'NORMAL' });
        // 1.0 - 1/2 = 0.5 → 50
        expect(calcMatchScore(a, b)).toBe(50);
      });

      it('최대 거리 → 0.0', () => {
        const a = make({ temperatureSensitivity: 'COLD' });
        const b = make({ temperatureSensitivity: 'HOT' });
        // 1.0 - 2/2 = 0.0
        expect(calcMatchScore(a, b)).toBe(0);
      });
    });

    describe('Pair 7b: indoorEating × indoorEatingTolerance (T3=2)', () => {
      it('RARELY × NO_SMELL → 1.0', () => {
        const a = make({ indoorEatingTolerance: 'NO_SMELL', indoorEating: 'RARELY' });
        const b = make({ indoorEating: 'RARELY', indoorEatingTolerance: 'NO_SMELL' });
        expect(calcMatchScore(a, b)).toBe(100);
      });

      it('MEAL × NO_SMELL → 0.0', () => {
        const a = make({ indoorEatingTolerance: 'NO_SMELL', indoorEating: 'RARELY' });
        const b = make({ indoorEating: 'MEAL', indoorEatingTolerance: 'ANY' });
        // a: NO_SMELL vs MEAL → 0.0
        expect(calcMatchScore(a, b)).toBe(0);
      });

      it('MEAL × CLEAN_OK → 0.5', () => {
        const a = make({ indoorEatingTolerance: 'CLEAN_OK', indoorEating: 'RARELY' });
        const b = make({ indoorEating: 'MEAL', indoorEatingTolerance: 'ANY' });
        // a: CLEAN_OK vs MEAL → 0.5
        // b: ANY vs RARELY → 1.0
        // a: (0.5×2)/2 × 100 = 50
        expect(calcMatchScore(a, b)).toBe(50);
      });

      it('SNACK × NO_SMELL → 1.0', () => {
        const a = make({ indoorEatingTolerance: 'NO_SMELL', indoorEating: 'RARELY' });
        const b = make({ indoorEating: 'SNACK', indoorEatingTolerance: 'ANY' });
        // a: NO_SMELL vs SNACK → 1.0
        expect(calcMatchScore(a, b)).toBe(100);
      });
    });

    describe('Pair 11: relationshipStyle (T4=1, 일치)', () => {
      it('같으면 1.0', () => {
        const a = make({ relationshipStyle: 'CLOSE' });
        const b = make({ relationshipStyle: 'CLOSE' });
        expect(calcMatchScore(a, b)).toBe(100);
      });

      it('다르면 0.0', () => {
        const a = make({ relationshipStyle: 'CLOSE' });
        const b = make({ relationshipStyle: 'CASUAL' });
        expect(calcMatchScore(a, b)).toBe(0);
      });
    });
  });

  // =========================================================
  // AC-F4: 양방향 min
  // =========================================================
  describe('AC-F4: 양방향 min', () => {
    it('A관점 높고 B관점 낮으면 최종=B관점 (min)', () => {
      // A: 흡연 엄격, 비흡연자
      // B: 흡연 관대, 흡연자
      const a = make({
        smokingTolerance: 'NO_ONLY',
        smokingBehavior: 'NO',
      });
      const b = make({
        smokingTolerance: 'ANY',
        smokingBehavior: 'YES',
      });
      // a evaluates b: NO_ONLY vs YES → 0.0 → a perspective = 0
      // b evaluates a: ANY vs NO → 1.0 → b perspective = 100
      // min(0, 100) = 0
      expect(calcMatchScore(a, b)).toBe(0);
    });

    it('양쪽 관점이 다를 때 min 적용 확인', () => {
      // A: 잠귀 민감, 잠버릇 없음
      // B: 잠귀 둔감, 코골이
      const a = make({
        noiseSensitivity: 'SENSITIVE',
        sleepHabit: 'NONE',
      });
      const b = make({
        noiseSensitivity: 'DEEP',
        sleepHabit: 'SNORING',
      });
      // a evaluates b: SENSITIVE vs SNORING → 0.0 → a perspective = 0
      // b evaluates a: DEEP vs NONE → 1.0 → b perspective = 100
      // min(0, 100) = 0
      expect(calcMatchScore(a, b)).toBe(0);
    });

    it('평균이 아닌 min임을 검증', () => {
      // 한쪽만 부분점수가 있는 경우
      const a = make({
        noiseSensitivity: 'NORMAL',
        sleepHabit: 'NONE',
      });
      const b = make({
        noiseSensitivity: 'DEEP',
        sleepHabit: 'TALKING',
      });
      // a evaluates b: NORMAL vs TALKING → 0.8
      // b evaluates a: DEEP vs NONE → 1.0
      // a perspective: (0.8×5)/5 × 100 = 80
      // b perspective: (1.0×5)/5 × 100 = 100
      // min(80, 100) = 80  (avg would be 90, max would be 100)
      expect(calcMatchScore(a, b)).toBe(80);
    });
  });

  // =========================================================
  // AC-B1: wakeTime FLEXIBLE 제외
  // =========================================================
  describe('AC-B1: wakeTime FLEXIBLE 제외', () => {
    it('한쪽 FLEXIBLE → 해당 쌍 weightedSum, dynamicMax 모두 제외', () => {
      // Only wakeTime pair is active, but FLEXIBLE should exclude it
      const a = make({ wakeTime: 'FLEXIBLE' });
      const b = make({ wakeTime: '08_09' });
      // wakeTime pair excluded → dynamicMax=0 → 100점
      expect(calcMatchScore(a, b)).toBe(100);
    });

    it('양쪽 FLEXIBLE → 제외', () => {
      const a = make({ wakeTime: 'FLEXIBLE' });
      const b = make({ wakeTime: 'FLEXIBLE' });
      expect(calcMatchScore(a, b)).toBe(100);
    });
  });

  // =========================================================
  // AC-B2: FLEXIBLE 제외 후 나머지 만점 → 100점
  // =========================================================
  describe('AC-B2: FLEXIBLE 제외 후 나머지 만점', () => {
    it('wakeTime FLEXIBLE, 나머지 12쌍 만점 → dynamicMax=34, 100점', () => {
      const base: LifestyleData = {
        ...FULL_PERFECT_A,
        wakeTime: 'FLEXIBLE',
      };
      const other: LifestyleData = {
        ...FULL_PERFECT_B,
        wakeTime: 'FLEXIBLE',
      };
      // wakeTime pair excluded: dynamicMax = 35 - 1 = 34
      // All 12 remaining pairs score 1.0
      // (34/34) × 100 = 100
      expect(calcMatchScore(base, other)).toBe(100);
    });
  });

  // =========================================================
  // AC-B3: 거리 기반 인접값과 최대 거리값 구분
  // =========================================================
  describe('AC-B3: 거리 기반 인접값 vs 최대 거리값', () => {
    it('bedtime 인접(0.67) vs 최대거리(0.0) 구분', () => {
      const adjacent = calcMatchScore(make({ bedtime: '22_24' }), make({ bedtime: '24_02' }));
      const maxDist = calcMatchScore(make({ bedtime: 'BEFORE_22' }), make({ bedtime: 'AFTER_02' }));
      expect(adjacent).toBe(67);
      expect(maxDist).toBe(0);
      expect(adjacent).toBeGreaterThan(maxDist);
    });

    it('temperature 인접(0.5) vs 최대거리(0.0) 구분', () => {
      const adjacent = calcMatchScore(
        make({ temperatureSensitivity: 'COLD' }),
        make({ temperatureSensitivity: 'NORMAL' }),
      );
      const maxDist = calcMatchScore(
        make({ temperatureSensitivity: 'COLD' }),
        make({ temperatureSensitivity: 'HOT' }),
      );
      expect(adjacent).toBe(50);
      expect(maxDist).toBe(0);
    });
  });

  // =========================================================
  // AC-B4: 반올림 규칙
  // =========================================================
  describe('AC-B4: 반올림 규칙 (Math.round)', () => {
    it('bedtime 인접 → 66.67 → round → 67', () => {
      const score = calcMatchScore(make({ bedtime: 'BEFORE_22' }), make({ bedtime: '22_24' }));
      expect(score).toBe(67);
    });

    it('bedtime 2칸 → 33.33 → round → 33', () => {
      const score = calcMatchScore(make({ bedtime: 'BEFORE_22' }), make({ bedtime: '24_02' }));
      expect(score).toBe(33);
    });
  });

  // =========================================================
  // Edge case: 모든 필드 null → dynamicMax=0 → 100점
  // =========================================================
  describe('Edge case: 모든 필드 null', () => {
    it('양쪽 모두 전체 null → 100점', () => {
      expect(calcMatchScore(EMPTY_LIFESTYLE, EMPTY_LIFESTYLE)).toBe(100);
    });

    it('한쪽만 전체 null → 100점', () => {
      expect(calcMatchScore(FULL_PERFECT_A, EMPTY_LIFESTYLE)).toBe(100);
      expect(calcMatchScore(EMPTY_LIFESTYLE, FULL_PERFECT_A)).toBe(100);
    });
  });

  // =========================================================
  // null 처리: 교차 비교에서 한쪽 null이면 쌍 제외
  // =========================================================
  describe('null 처리', () => {
    it('교차 비교: evaluator tolerance null → 해당 쌍 제외', () => {
      const a = make({ smokingTolerance: null, smokingBehavior: 'NO' });
      const b = make({ smokingBehavior: 'YES', smokingTolerance: null });
      // 양쪽 모두 tolerance null → smoking pair 제외
      // dynamicMax=0 → 100
      expect(calcMatchScore(a, b)).toBe(100);
    });

    it('교차 비교: target behavior null → 해당 쌍 제외', () => {
      const a = make({ smokingTolerance: 'NO_ONLY', smokingBehavior: null });
      const b = make({ smokingBehavior: null, smokingTolerance: 'NO_ONLY' });
      // target smokingBehavior null → pair 제외
      expect(calcMatchScore(a, b)).toBe(100);
    });

    it('유사도 비교: 한쪽 bedtime null → 쌍 제외', () => {
      const a = make({ bedtime: null });
      const b = make({ bedtime: '22_24' });
      expect(calcMatchScore(a, b)).toBe(100);
    });

    it('교차 비교: 한쪽 indoorEatingTolerance null → 쌍 제외', () => {
      const a = make({ indoorEatingTolerance: null, indoorEating: 'RARELY' });
      const b = make({ indoorEating: 'MEAL', indoorEatingTolerance: null });
      expect(calcMatchScore(a, b)).toBe(100);
    });
  });

  // =========================================================
  // 복합 시나리오: 여러 쌍이 동시에 참여
  // =========================================================
  describe('복합 시나리오', () => {
    it('smoking(T1=5) 0점 + bedtime(T3=2) 만점 → 가중 계산', () => {
      const a = make({
        smokingTolerance: 'NO_ONLY',
        smokingBehavior: 'NO',
        bedtime: '22_24',
      });
      const b = make({
        smokingBehavior: 'YES',
        smokingTolerance: 'ANY',
        bedtime: '22_24',
      });
      // a evaluates b:
      //   Pair 1: NO_ONLY vs YES → 0.0 × 5 = 0
      //   Pair 9: bedtime same → 1.0 × 2 = 2
      //   dynamicMax = 5 + 2 = 7
      //   score = (2/7) × 100 = 28.57 → 29
      // b evaluates a:
      //   Pair 1: ANY vs NO → 1.0 × 5 = 5
      //   Pair 9: bedtime same → 1.0 × 2 = 2
      //   dynamicMax = 7
      //   score = (7/7) × 100 = 100
      // min(29, 100) = 29
      expect(calcMatchScore(a, b)).toBe(29);
    });

    it('전체 13쌍 참여, 다양한 점수 조합', () => {
      const a: LifestyleData = {
        bedtime: '22_24',
        wakeTime: '07_08',
        sleepHabit: 'NONE',
        sleepEnvironment: 'QUIET',
        screenUsage: 'NONE',
        noiseSensitivity: 'SENSITIVE',
        smokingBehavior: 'NO',
        indoorEating: 'RARELY',
        phoneBehavior: 'RARELY',
        earphoneUsage: 'ALWAYS',
        cleanLevel: 'WEEKLY_3_UP',
        drinkingFrequency: 'NONE',
        relationshipStyle: 'CLOSE',
        temperatureSensitivity: 'COLD',
        smokingTolerance: 'NO_ONLY',
        phoneTolerance: 'OUTSIDE_ONLY',
        earphoneExpectation: 'MUST',
        sleepEnvPreference: 'NO_SPEAKER',
        screenTolerance: 'SCREEN_OK',
        indoorEatingTolerance: 'NO_SMELL',
        cleanExpectation: 'STRICT',
        drinkingTolerance: 'LOW_ONLY',
      };

      const b: LifestyleData = {
        bedtime: '24_02', // distance 1 from 22_24 → 0.667
        wakeTime: '08_09', // distance 1 from 07_08 → 0.75
        sleepHabit: 'TALKING', // SENSITIVE vs TALKING → 0.3
        sleepEnvironment: 'QUIET', // NO_SPEAKER vs QUIET → 1.0
        screenUsage: 'NONE', // SCREEN_OK vs NONE → 1.0
        noiseSensitivity: 'DEEP',
        smokingBehavior: 'NO', // NO_ONLY vs NO → 1.0
        indoorEating: 'MEAL', // NO_SMELL vs MEAL → 0.0
        phoneBehavior: 'SOMETIMES', // OUTSIDE_ONLY vs SOMETIMES → 0.0
        earphoneUsage: 'MOSTLY', // MUST vs MOSTLY → 0.7
        cleanLevel: 'WEEKLY_1_2', // STRICT vs WEEKLY_1_2 → 0.3
        drinkingFrequency: 'NONE', // LOW_ONLY vs NONE → 1.0
        relationshipStyle: 'CASUAL', // CLOSE vs CASUAL → 0.0
        temperatureSensitivity: 'NORMAL', // distance 1 → 0.5
        smokingTolerance: 'ANY',
        phoneTolerance: 'ANY',
        earphoneExpectation: 'ANY',
        sleepEnvPreference: 'SPEAKER_OK',
        screenTolerance: 'NO_SCREEN',
        indoorEatingTolerance: 'ANY',
        cleanExpectation: 'FLEXIBLE',
        drinkingTolerance: 'ANY',
      };

      // a evaluates b (a is evaluator):
      // Pair 1: smokingTol=NO_ONLY vs smokingBeh=NO → 1.0 × 5 = 5
      // Pair 2: drinkingTol=LOW_ONLY vs drinkingFreq=NONE → 1.0 × 2 = 2
      // Pair 3: noiseSens=SENSITIVE vs sleepHabit=TALKING → 0.3 × 5 = 1.5
      // Pair 4: phoneTol=OUTSIDE_ONLY vs phoneBeh=SOMETIMES → 0.0 × 3 = 0
      // Pair 5: earphoneExp=MUST vs earphoneUse=MOSTLY → 0.7 × 3 = 2.1
      // Pair 6: sleepEnvPref=NO_SPEAKER vs sleepEnv=QUIET → 1.0 × 3 = 3
      // Pair 6b: screenTol=SCREEN_OK vs screenUsage=NONE → 1.0 × 3 = 3
      // Pair 7: cleanExp=STRICT vs cleanLvl=WEEKLY_1_2 → 0.3 × 2 = 0.6
      // Pair 7b: indoorEatingTol=NO_SMELL vs indoorEating=MEAL → 0.0 × 2 = 0
      // Pair 8: bedtime 22_24(1) vs 24_02(2) → 1.0-1/3=0.667 × 2 = 1.333
      // Pair 9: wakeTime 07_08(1) vs 08_09(2) → 1.0-1/4=0.75 × 1 = 0.75
      // Pair 10: temp COLD(0) vs NORMAL(1) → 1.0-1/2=0.5 × 3 = 1.5
      // Pair 11: relationship CLOSE vs CASUAL → 0.0 × 1 = 0
      // weightedSum = 5+2+1.5+0+2.1+3+3+0.6+0+1.333+0.75+1.5+0 = 20.783
      // dynamicMax = 35
      // aPerspective = round(20.783/35 × 100) = round(59.38) = 59

      // b evaluates a (b is evaluator):
      // Pair 1: smokingTol=ANY vs smokingBeh=NO → 1.0 × 5 = 5
      // Pair 2: drinkingTol=ANY vs drinkingFreq=NONE → 1.0 × 2 = 2
      // Pair 3: noiseSens=DEEP vs sleepHabit=NONE → 1.0 × 5 = 5
      // Pair 4: phoneTol=ANY vs phoneBeh=RARELY → 1.0 × 3 = 3
      // Pair 5: earphoneExp=ANY vs earphoneUse=ALWAYS → 1.0 × 3 = 3
      // Pair 6: sleepEnvPref=SPEAKER_OK vs sleepEnv=QUIET → 1.0 × 3 = 3
      // Pair 6b: screenTol=NO_SCREEN vs screenUsage=NONE → 1.0 × 3 = 3
      // Pair 7: cleanExp=FLEXIBLE vs cleanLvl=WEEKLY_3_UP → 1.0 × 2 = 2
      // Pair 7b: indoorEatingTol=ANY vs indoorEating=RARELY → 1.0 × 2 = 2
      // Pair 8: bedtime 24_02(2) vs 22_24(1) → 0.667 × 2 = 1.333
      // Pair 9: wakeTime 08_09(2) vs 07_08(1) → 0.75 × 1 = 0.75
      // Pair 10: temp NORMAL(1) vs COLD(0) → 0.5 × 3 = 1.5
      // Pair 11: relationship CASUAL vs CLOSE → 0.0 × 1 = 0
      // weightedSum = 5+2+5+3+3+3+3+2+2+1.333+0.75+1.5+0 = 31.583
      // dynamicMax = 35
      // bPerspective = round(31.583/35 × 100) = round(90.24) = 90

      // min(59, 90) = 59
      expect(calcMatchScore(a, b)).toBe(59);
    });
  });
});

// =========================================================
// calcMatchScoreWithGating — 3-state 게이팅
// =========================================================

describe('calcMatchScoreWithGating', () => {
  // 조건 완성 프로필: FULL_PERFECT_A (조건 8개 전부 non-null)
  // 조건 미완성 프로필: 필수 15필드는 있지만 조건 7개 null (drinkingTolerance만 있음)
  const INCOMPLETE_CONDITIONS: LifestyleData = {
    bedtime: '22_24',
    wakeTime: '07_08',
    sleepHabit: 'NONE',
    sleepEnvironment: 'QUIET',
    screenUsage: 'NONE',
    noiseSensitivity: 'SENSITIVE',
    smokingBehavior: 'NO',
    indoorEating: 'RARELY',
    phoneBehavior: 'RARELY',
    earphoneUsage: 'ALWAYS',
    cleanLevel: 'WEEKLY_3_UP',
    drinkingFrequency: 'NONE',
    relationshipStyle: 'CLOSE',
    temperatureSensitivity: 'COLD',
    smokingTolerance: null,
    phoneTolerance: null,
    earphoneExpectation: null,
    sleepEnvPreference: null,
    screenTolerance: null,
    indoorEatingTolerance: null,
    cleanExpectation: null,
    drinkingTolerance: 'LOW_ONLY',
  };

  describe('full: 양쪽 조건 완성', () => {
    it('type이 full이고 score가 min(A→B, B→A)', () => {
      const result = calcMatchScoreWithGating(FULL_PERFECT_A, FULL_PERFECT_B);
      expect(result.type).toBe('full');
      expect(result.score).toBe(calcMatchScore(FULL_PERFECT_A, FULL_PERFECT_B));
    });

    it('score가 null이 아님', () => {
      const result = calcMatchScoreWithGating(FULL_PERFECT_A, FULL_PERFECT_B);
      expect(result.score).not.toBeNull();
    });
  });

  describe('partial: 나만 완성, 상대 미완성', () => {
    it('type이 partial', () => {
      const result = calcMatchScoreWithGating(FULL_PERFECT_A, INCOMPLETE_CONDITIONS);
      expect(result.type).toBe('partial');
    });

    it('score가 null이 아님 (단방향 점수)', () => {
      const result = calcMatchScoreWithGating(FULL_PERFECT_A, INCOMPLETE_CONDITIONS);
      expect(result.score).not.toBeNull();
      expect(typeof result.score).toBe('number');
    });

    it('score가 0~100 범위', () => {
      const result = calcMatchScoreWithGating(FULL_PERFECT_A, INCOMPLETE_CONDITIONS);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('상대 조건 1개만 null이어도 partial', () => {
      const oneNull = { ...FULL_PERFECT_A, smokingTolerance: null };
      const result = calcMatchScoreWithGating(FULL_PERFECT_A, oneNull);
      expect(result.type).toBe('partial');
    });
  });

  describe('gated: 내가 미완성', () => {
    it('type이 gated이고 score가 null', () => {
      const result = calcMatchScoreWithGating(INCOMPLETE_CONDITIONS, FULL_PERFECT_A);
      expect(result.type).toBe('gated');
      expect(result.score).toBeNull();
    });

    it('나와 상대 모두 미완성이어도 gated', () => {
      const result = calcMatchScoreWithGating(INCOMPLETE_CONDITIONS, INCOMPLETE_CONDITIONS);
      expect(result.type).toBe('gated');
      expect(result.score).toBeNull();
    });

    it('내 조건 1개만 null이어도 gated', () => {
      const oneNull = { ...FULL_PERFECT_A, phoneTolerance: null };
      const result = calcMatchScoreWithGating(oneNull, FULL_PERFECT_A);
      expect(result.type).toBe('gated');
      expect(result.score).toBeNull();
    });
  });

  describe('일관성', () => {
    it('full의 score는 calcMatchScore와 동일', () => {
      const result = calcMatchScoreWithGating(FULL_PERFECT_A, FULL_PERFECT_B);
      expect(result.score).toBe(calcMatchScore(FULL_PERFECT_A, FULL_PERFECT_B));
    });

    it('partial의 score는 full의 score 이상 (min 특성)', () => {
      // partial = perspectiveScore(A, B), full = min(A→B, B→A)
      // perspectiveScore(A, B) >= min(A→B, B→A) 항상 성립
      const completeB = { ...FULL_PERFECT_A, smokingBehavior: 'YES' as const };
      const full = calcMatchScoreWithGating(FULL_PERFECT_A, completeB);
      const incompleteB = { ...completeB, smokingTolerance: null };
      const partial = calcMatchScoreWithGating(FULL_PERFECT_A, incompleteB);
      if (full.score !== null && partial.score !== null) {
        expect(partial.score).toBeGreaterThanOrEqual(full.score);
      }
    });
  });
});
