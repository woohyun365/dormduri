export interface LifestyleData {
  smoker: 'NO' | 'YES' | 'OK' | null;
  sleepHabit: 'NONE' | 'TALKING' | 'SNORING' | 'GRINDING' | null;
  indoorEating: 'NO' | 'OK' | 'VENTILATE' | null;
  bedtime: 'BEFORE_22' | '22_24' | '24_02' | 'AFTER_02' | null;
  wakeTime: 'BEFORE_06' | '06_08' | '08_10' | 'AFTER_10' | null;
  noiseSensitivity: 'LOW' | 'MID' | 'HIGH' | null;
  cleanliness: 'LOW' | 'MID' | 'HIGH' | null;
  relationshipStyle: 'CLOSE' | 'CASUAL' | null;
}
