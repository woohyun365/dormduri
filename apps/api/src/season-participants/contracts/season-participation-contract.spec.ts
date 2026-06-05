import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CORE_LIFESTYLE_FIELDS,
  ROOMMATE_CONDITION_FIELDS,
  type LifestyleData,
} from '@repo/shared/lifestyle';
import { additionalProfileSchema } from '@repo/shared/profile-contract';
import * as legacySeasonContract from '@repo/shared/season-contract';
import * as seasonParticipationContract from '@repo/shared/season/participation';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SHARED_SRC_DIR = path.resolve(CURRENT_DIR, '../../../../../packages/shared/src');
const SHARED_PACKAGE_JSON_PATH = path.resolve(
  CURRENT_DIR,
  '../../../../../packages/shared/package.json',
);

const VALID_LIFESTYLE: LifestyleData = {
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
  cleanLevel: 'WEEKLY_3_UP',
  drinkingFrequency: 'NONE',
  relationshipStyle: 'CLOSE',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'NO_ONLY',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'STUDY',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
  indoorEatingTolerance: 'CLEAN_OK',
  cleanExpectation: 'BASIC',
  drinkingTolerance: 'LOW_ONLY',
};

const COMPLETION_READY = {
  profileCompletionRequired: false,
  dormitorySelectionRequired: false,
  registrationUnavailable: false,
  registrationUnavailableReasons: [],
} as const;

describe('season participation shared contract', () => {
  it('old season-contract participation exports는 new season/participation barrel과 같은 schema surface를 re-export한다', () => {
    expect(legacySeasonContract.seasonProfileDraftRequestSchema).toBe(
      seasonParticipationContract.seasonProfileDraftRequestSchema,
    );
    expect(legacySeasonContract.selectableDormitoriesResponseSchema).toBe(
      seasonParticipationContract.selectableDormitoriesResponseSchema,
    );
    expect(legacySeasonContract.seasonRegistrationFinalizeResponseSchema).toBe(
      seasonParticipationContract.seasonRegistrationFinalizeResponseSchema,
    );
  });

  it('season profile draft contract는 account display/academic identity와 season additional을 분리하고 intro optional을 허용한다', () => {
    expect(
      additionalProfileSchema.safeParse({
        grade: '3',
        mbti: 'INTJ',
      }).success,
    ).toBe(true);

    expect(
      additionalProfileSchema.safeParse({
        college: 'ARTS_ENGINEERING',
        grade: '3',
        mbti: 'INTJ',
        birthYear: 2002,
      }).success,
    ).toBe(false);

    const validSeasonProfileDraftRequest = {
      lifestyle: VALID_LIFESTYLE,
      additional: {
        grade: '3',
        mbti: 'INTJ',
      },
    } as const;

    expect(
      seasonParticipationContract.createSeasonProfileRequestSchema.safeParse(
        validSeasonProfileDraftRequest,
      ).success,
    ).toBe(true);

    expect(
      seasonParticipationContract.createSeasonProfileRequestSchema.safeParse({
        ...validSeasonProfileDraftRequest,
        nickname: '시즌닉네임',
      }).success,
    ).toBe(false);
    expect(
      seasonParticipationContract.createSeasonProfileRequestSchema.safeParse({
        ...validSeasonProfileDraftRequest,
        displayIdentity: { nickname: '시즌닉네임' },
      }).success,
    ).toBe(false);
    expect(
      seasonParticipationContract.createSeasonProfileRequestSchema.safeParse({
        ...validSeasonProfileDraftRequest,
        academicIdentity: {
          collegeCode: 'ARTS_ENGINEERING',
          birthYear: 2002,
        },
      }).success,
    ).toBe(false);

    const seasonProfileDraftResponse = {
      participantId: null,
      seasonId: 'season-1',
      state: 'NONE',
      lifestyle: Object.fromEntries(
        [...CORE_LIFESTYLE_FIELDS, ...ROOMMATE_CONDITION_FIELDS].map((field) => [field, null]),
      ),
      intro: '',
      additional: {
        grade: null,
        mbti: null,
      },
      completion: {
        profileCompletionRequired: true,
        dormitorySelectionRequired: true,
        registrationUnavailable: true,
        registrationUnavailableReasons: ['PROFILE_INCOMPLETE', 'DORMITORY_SELECTION_REQUIRED'],
      },
      draftWritable: true,
    } as const;

    expect(
      seasonParticipationContract.seasonProfileDraftResponseSchema.safeParse(
        seasonProfileDraftResponse,
      ).success,
    ).toBe(true);
    expect(
      seasonParticipationContract.seasonProfileDraftResponseSchema.safeParse({
        ...seasonProfileDraftResponse,
        displayIdentity: {
          nickname: '현재닉네임',
          nicknameSource: 'USER_DISPLAY_IDENTITY',
          nicknameChangedAt: null,
        },
      }).success,
    ).toBe(false);
  });

  it('dormitory selection draft contract와 registration finalize contract를 분리해 표현한다', () => {
    expect(
      seasonParticipationContract.selectableDormitoriesResponseSchema.parse({
        seasonId: 'season-1',
        seasonState: 'SEASON_OPEN',
        profileState: 'COMPLETE',
        completion: {
          profileCompletionRequired: false,
          dormitorySelectionRequired: true,
          registrationUnavailable: false,
          registrationUnavailableReasons: [],
        },
        items: [
          {
            id: 'dasan',
            name: '다산관',
            campusCode: 'CHUNCHEON',
            roomType: 2,
            genderPolicy: 'M',
            roomSelectionDate: '2026-02-11',
          },
        ],
      }),
    ).toMatchObject({ profileState: 'COMPLETE', items: [{ id: 'dasan' }] });

    expect(
      seasonParticipationContract.selectedDormitorySubmitRequestSchema.parse({
        dormitoryId: 'dasan',
      }),
    ).toMatchObject({ dormitoryId: 'dasan' });

    expect(
      seasonParticipationContract.dormitorySelectionDraftResponseSchema.parse({
        seasonId: 'season-1',
        participantId: 'participant-1',
        dormitorySelectionState: 'SELECTED',
        dormitoryId: 'dasan',
        profileState: 'COMPLETE',
        completion: COMPLETION_READY,
      }),
    ).toMatchObject({ dormitorySelectionState: 'SELECTED', dormitoryId: 'dasan' });

    expect(seasonParticipationContract.seasonRegistrationFinalizeRequestSchema.parse({})).toEqual(
      {},
    );
    expect(
      seasonParticipationContract.seasonRegistrationFinalizeRequestSchema.safeParse({
        dormitoryId: 'dasan',
      }).success,
    ).toBe(false);

    expect(
      seasonParticipationContract.seasonRegistrationFinalizeResponseSchema.parse({
        seasonId: 'season-1',
        participantId: 'participant-1',
        participationIntent: 'REGISTERED',
        registeredAt: '2026-05-20T00:00:00.000Z',
        dormitorySelectionState: 'ASSIGNED',
        dormitoryId: 'dasan',
        profileState: 'REGISTRATION_FINALIZED',
        profileHistoryId: 'history-1',
        registeredAtSnapshot: '2026-05-20T00:00:00.000Z',
        completion: COMPLETION_READY,
      }),
    ).toMatchObject({ dormitorySelectionState: 'ASSIGNED' });
  });

  it('season participation은 root legacy file 없이 season/participation owner와 season-contract compat가 소유한다', () => {
    const packageJson = JSON.parse(readFileSync(SHARED_PACKAGE_JSON_PATH, 'utf8')) as {
      exports: Record<string, unknown>;
    };

    expect(existsSync(path.join(SHARED_SRC_DIR, 'season-participation-contract.ts'))).toBe(false);
    expect(packageJson.exports['./season/participation']).toBeDefined();
    expect(packageJson.exports['./season-participation-contract']).toBeUndefined();
  });
});
