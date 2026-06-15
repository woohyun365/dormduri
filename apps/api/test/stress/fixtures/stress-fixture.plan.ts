import { fileURLToPath } from 'node:url';

import { redactStressFixtureSecrets } from '../safety/stress-secret-redaction.js';
import {
  createStressFixtureConfigFromEnv,
  type StressFixtureConfig,
} from './stress-fixture.config.js';

export type StressActorRole = 'search-reader' | 'request-writer' | 'chat-reader' | 'support-light';
export type StressGender = 'M' | 'F';

export interface StressDormitoryPlanRow {
  readonly id: string;
  readonly campusCode: string;
  readonly nameKo: string;
  readonly roomType: number;
  readonly genderPolicy: StressGender;
  readonly sortOrder: number;
}

export interface StressCohortPlanRow {
  readonly id: string;
  readonly label: string;
  readonly dormitoryId: string;
  readonly gender: StressGender;
  readonly size: number;
  readonly memberActorIndexes: readonly number[];
}

export interface StressActorPlanRow {
  readonly index: number;
  readonly actorId: string;
  readonly role: StressActorRole;
  readonly userId: string;
  readonly participantId: string;
  readonly profileId: string;
  readonly email: string;
  readonly password: string;
  readonly accessToken: string;
  readonly sessionCookie: string;
  readonly dormitoryId: string;
  readonly gender: StressGender;
  readonly cohortLabels: readonly string[];
}

export interface StressFixturePlan {
  readonly marker: string;
  readonly config: StressFixtureConfig;
  readonly campus: {
    readonly code: string;
    readonly nameKo: string;
  };
  readonly season: {
    readonly id: string;
    readonly campusCode: string;
    readonly academicYear: number;
    readonly semester: number;
    readonly name: string;
  };
  readonly dormitories: readonly StressDormitoryPlanRow[];
  readonly cohorts: readonly StressCohortPlanRow[];
  readonly actors: readonly StressActorPlanRow[];
}

export interface StressFixtureSafeSummary {
  readonly marker: string;
  readonly campusCode: string;
  readonly seasonId: string;
  readonly actorCount: number;
  readonly dormitoryCount: number;
  readonly cohorts: readonly Omit<StressCohortPlanRow, 'memberActorIndexes'>[];
  readonly sampleActors: readonly ReturnType<typeof redactStressFixtureSecrets>[];
}

export function buildStressFixturePlan(config: StressFixtureConfig): StressFixturePlan {
  const dormitories = buildDormitoryPlan(config);
  const primaryDormitoryId = dormitories[0]?.id;

  if (!primaryDormitoryId) {
    throw new Error('Stress fixture plan requires at least one dormitory.');
  }

  const actors = Array.from({ length: config.stressCohortSize }, (_, zeroBasedIndex) => {
    const index = zeroBasedIndex + 1;
    const padded = index.toString().padStart(4, '0');
    const inObservedLargestCohort = index <= config.largestCohortSize;

    return {
      index,
      actorId: `${config.prefix}-actor-${padded}`,
      role: pickRole(index),
      userId: `${config.prefix}-user-${padded}`,
      participantId: `${config.prefix}-participant-${padded}`,
      profileId: `${config.prefix}-profile-${padded}`,
      email: `${config.prefix}+${padded}@stress.example.invalid`,
      password: `${config.prefix}-password-${padded}`,
      accessToken: `${config.prefix}-access-token-${padded}`,
      sessionCookie: `stress_session=${config.prefix}-session-${padded}`,
      dormitoryId: primaryDormitoryId,
      gender: 'M',
      cohortLabels: inObservedLargestCohort
        ? ['largest-observed-237', 'stress-expanded-946']
        : ['stress-expanded-946'],
    } satisfies StressActorPlanRow;
  });

  return {
    marker: config.prefix,
    config,
    campus: {
      code: config.campusCode,
      nameKo: `Stress ${config.campusCode}`,
    },
    season: {
      id: config.seasonId,
      campusCode: config.campusCode,
      academicYear: config.academicYear,
      semester: config.semester,
      name: `${config.academicYear}-${config.semester} stress`,
    },
    dormitories,
    cohorts: [
      {
        id: `${config.prefix}-largest-observed-237`,
        label: 'largest-observed-237',
        dormitoryId: primaryDormitoryId,
        gender: 'M',
        size: config.largestCohortSize,
        memberActorIndexes: Array.from(
          { length: config.largestCohortSize },
          (_, index) => index + 1,
        ),
      },
      {
        id: `${config.prefix}-stress-expanded-946`,
        label: 'stress-expanded-946',
        dormitoryId: primaryDormitoryId,
        gender: 'M',
        size: config.stressCohortSize,
        memberActorIndexes: Array.from(
          { length: config.stressCohortSize },
          (_, index) => index + 1,
        ),
      },
    ],
    actors,
  };
}

export function buildStressFixtureSafeSummary(plan: StressFixturePlan): StressFixtureSafeSummary {
  return {
    marker: plan.marker,
    campusCode: plan.campus.code,
    seasonId: plan.season.id,
    actorCount: plan.actors.length,
    dormitoryCount: plan.dormitories.length,
    cohorts: plan.cohorts.map(({ memberActorIndexes: _memberActorIndexes, ...cohort }) => cohort),
    sampleActors: plan.actors.slice(0, 3).map((actor) =>
      redactStressFixtureSecrets({
        index: actor.index,
        actorId: actor.actorId,
        role: actor.role,
        email: actor.email,
        token: actor.accessToken,
        password: actor.password,
        sessionCookie: actor.sessionCookie,
        dormitoryId: actor.dormitoryId,
        gender: actor.gender,
        cohortLabels: actor.cohortLabels,
      }),
    ),
  };
}

function buildDormitoryPlan(config: StressFixtureConfig): readonly StressDormitoryPlanRow[] {
  return Array.from({ length: config.dormitoryCount }, (_, zeroBasedIndex) => {
    const index = zeroBasedIndex + 1;
    const padded = index.toString().padStart(2, '0');

    return {
      id: `${config.prefix}-dormitory-${padded}`,
      campusCode: config.campusCode,
      nameKo: `스트레스 기숙사 ${padded}`,
      roomType: config.roomType,
      genderPolicy: index % 2 === 0 ? 'F' : 'M',
      sortOrder: index,
    } satisfies StressDormitoryPlanRow;
  });
}

function pickRole(index: number): StressActorRole {
  if (index % 20 === 0) {
    return 'support-light';
  }

  if (index % 5 === 0) {
    return 'request-writer';
  }

  if (index % 3 === 0) {
    return 'chat-reader';
  }

  return 'search-reader';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const plan = buildStressFixturePlan(createStressFixtureConfigFromEnv());
  console.log(JSON.stringify(buildStressFixtureSafeSummary(plan), null, 2));
}
