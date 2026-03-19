// === 수면 패턴 (필수 6개) ===

// 행동 (5개)
export type Bedtime = 'BEFORE_22' | '22_24' | '24_02' | 'AFTER_02';
export type WakeTime = 'BEFORE_07' | '07_08' | '08_09' | '09_10' | 'AFTER_10' | 'FLEXIBLE';
export type SleepHabit = 'NONE' | 'TALKING' | 'SNORING' | 'GRINDING';
export type SleepEnvironment = 'QUIET' | 'EARPHONE' | 'LOW_SPEAKER';
export type ScreenUsage = 'NONE' | 'AUDIO' | 'SCREEN';

// 특성 (1개)
export type NoiseSensitivity = 'SENSITIVE' | 'NORMAL' | 'DEEP';

// === 생활 패턴 (필수 8개) ===

// 행동 (7개)
export type SmokingBehavior = 'NO' | 'E_CIG' | 'YES';
export type IndoorEating = 'RARELY' | 'SNACK' | 'MEAL';
export type PhoneBehavior = 'RARELY' | 'SOMETIMES' | 'OFTEN';
export type EarphoneUsage = 'ALWAYS' | 'MOSTLY' | 'MOSTLY_SPEAKER' | 'ALWAYS_SPEAKER';
export type CleanLevel = 'WHEN_DIRTY' | 'WEEKLY_1_2' | 'WEEKLY_3_UP';
export type DrinkingFrequency = 'NONE' | 'RARELY' | 'SOMETIMES' | 'OFTEN';
export type RelationshipStyle = 'CLOSE' | 'CASUAL';

// 특성 (1개)
export type TemperatureSensitivity = 'COLD' | 'NORMAL' | 'HOT';

// === 원하는 룸메 조건 (필수 8개) ===

export type SmokingTolerance = 'NO_ONLY' | 'E_CIG_OK' | 'ANY';
export type PhoneTolerance = 'OUTSIDE_ONLY' | 'BRIEF_OK' | 'ANY';
export type EarphoneExpectation = 'MUST' | 'STUDY' | 'ANY';
export type SleepEnvPreference = 'NO_SPEAKER' | 'SPEAKER_OK';
export type ScreenTolerance = 'NO_SCREEN' | 'LOW_OK' | 'SCREEN_OK';
export type IndoorEatingTolerance = 'NO_SMELL' | 'CLEAN_OK' | 'ANY';
export type CleanExpectation = 'STRICT' | 'BASIC' | 'FLEXIBLE';
export type DrinkingTolerance = 'LOW_ONLY' | 'ANY';

// === LifestyleData (22필드) ===

export interface LifestyleData {
  // 수면 패턴 (6개)
  bedtime: Bedtime | null;
  wakeTime: WakeTime | null;
  sleepHabit: SleepHabit | null;
  sleepEnvironment: SleepEnvironment | null;
  screenUsage: ScreenUsage | null;
  noiseSensitivity: NoiseSensitivity | null;

  // 생활 패턴 (8개)
  smokingBehavior: SmokingBehavior | null;
  indoorEating: IndoorEating | null;
  phoneBehavior: PhoneBehavior | null;
  earphoneUsage: EarphoneUsage | null;
  cleanLevel: CleanLevel | null;
  drinkingFrequency: DrinkingFrequency | null;
  relationshipStyle: RelationshipStyle | null;
  temperatureSensitivity: TemperatureSensitivity | null;

  // 원하는 룸메 조건 (8개)
  smokingTolerance: SmokingTolerance | null;
  phoneTolerance: PhoneTolerance | null;
  earphoneExpectation: EarphoneExpectation | null;
  sleepEnvPreference: SleepEnvPreference | null;
  screenTolerance: ScreenTolerance | null;
  indoorEatingTolerance: IndoorEatingTolerance | null;
  cleanExpectation: CleanExpectation | null;
  drinkingTolerance: DrinkingTolerance | null;
}
