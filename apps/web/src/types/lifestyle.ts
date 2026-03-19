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
export type IndoorEating = 'NO' | 'OK' | 'VENTILATE';
export type PhoneBehavior = 'OUTSIDE' | 'BRIEF' | 'FREE';
export type EarphoneUsage = 'ALWAYS' | 'STUDY' | 'QUIET' | 'FREE';
export type CleanLevel = 'WHEN_DIRTY' | 'WEEKLY_1_2' | 'WEEKLY_3_UP';
export type DrinkingFrequency = 'NONE' | 'SOMETIMES' | 'OFTEN';
export type RelationshipStyle = 'CLOSE' | 'CASUAL';

// 특성 (1개)
export type TemperatureSensitivity = 'COLD' | 'NORMAL' | 'HOT';

// === 원하는 룸메 조건 (필수 7개) ===

export type SmokingTolerance = 'NO_ONLY' | 'E_CIG_OK' | 'ANY';
export type PhoneTolerance = 'OUTSIDE_ONLY' | 'BRIEF_OK' | 'ANY';
export type EarphoneExpectation = 'MUST' | 'STUDY' | 'ANY';
export type SleepEnvPreference = 'NO_SPEAKER' | 'SPEAKER_OK';
export type ScreenTolerance = 'NO_SCREEN' | 'SCREEN_OK';
export type CleanExpectation = 'STRICT' | 'BASIC' | 'FLEXIBLE';
export type DrinkingTolerance = 'NONE_ONLY' | 'SOMETIMES_OK' | 'ANY';

// === LifestyleData (21필드) ===

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

  // 원하는 룸메 조건 (7개)
  smokingTolerance: SmokingTolerance | null;
  phoneTolerance: PhoneTolerance | null;
  earphoneExpectation: EarphoneExpectation | null;
  sleepEnvPreference: SleepEnvPreference | null;
  screenTolerance: ScreenTolerance | null;
  cleanExpectation: CleanExpectation | null;
  drinkingTolerance: DrinkingTolerance | null;
}
