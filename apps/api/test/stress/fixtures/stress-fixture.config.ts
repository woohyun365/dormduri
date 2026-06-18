export interface StressFixtureConfig {
  readonly prefix: string;
  readonly campusCode: string;
  readonly seasonId: string;
  readonly largestCohortSize: number;
  readonly stressCohortSize: number;
  readonly dormitoryCount: number;
  readonly roomType: number;
  readonly academicYear: number;
  readonly semester: number;
}

export const DEFAULT_STRESS_FIXTURE_CONFIG: StressFixtureConfig = {
  prefix: 'stress-local',
  campusCode: 'CHUNCHEON',
  seasonId: 'stress-season-local',
  largestCohortSize: 237,
  stressCohortSize: 946,
  dormitoryCount: 4,
  roomType: 2,
  academicYear: 2026,
  semester: 1,
};

export function createStressFixtureConfig(
  overrides: Partial<StressFixtureConfig> = {},
): StressFixtureConfig {
  const config = {
    ...DEFAULT_STRESS_FIXTURE_CONFIG,
    ...overrides,
  };

  validateStressFixtureConfig(config);

  return config;
}

export function createStressFixtureConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): StressFixtureConfig {
  return createStressFixtureConfig(
    stripUndefinedValues({
      prefix: env.STRESS_FIXTURE_PREFIX,
      campusCode: env.STRESS_CAMPUS_CODE,
      seasonId: env.STRESS_SEASON_ID,
      largestCohortSize: parseOptionalPositiveInteger(env.STRESS_LARGEST_COHORT_SIZE),
      stressCohortSize: parseOptionalPositiveInteger(env.STRESS_COHORT_SIZE),
      dormitoryCount: parseOptionalPositiveInteger(env.STRESS_DORMITORY_COUNT),
      roomType: parseOptionalPositiveInteger(env.STRESS_ROOM_TYPE),
      academicYear: parseOptionalPositiveInteger(env.STRESS_ACADEMIC_YEAR),
      semester: parseOptionalPositiveInteger(env.STRESS_SEMESTER),
    }),
  );
}

function validateStressFixtureConfig(config: StressFixtureConfig) {
  const numericEntries: ReadonlyArray<readonly [keyof StressFixtureConfig, number]> = [
    ['largestCohortSize', config.largestCohortSize],
    ['stressCohortSize', config.stressCohortSize],
    ['dormitoryCount', config.dormitoryCount],
    ['roomType', config.roomType],
    ['academicYear', config.academicYear],
    ['semester', config.semester],
  ];

  for (const [key, value] of numericEntries) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Stress fixture config ${String(key)} must be a positive integer.`);
    }
  }

  if (config.stressCohortSize < config.largestCohortSize) {
    throw new Error('Stress fixture config stressCohortSize must be >= largestCohortSize.');
  }

  if (!/^[a-z0-9][a-z0-9-]{2,48}$/u.test(config.prefix)) {
    throw new Error('Stress fixture config prefix must be a short lowercase marker string.');
  }
}

function parseOptionalPositiveInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer env value but received ${value}.`);
  }

  return parsed;
}

function stripUndefinedValues(
  value: Partial<Record<keyof StressFixtureConfig, string | number | undefined>>,
): Partial<StressFixtureConfig> {
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [keyof StressFixtureConfig, string | number] => entry[1] !== undefined,
    ),
  );
}
