import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hash as argonHash } from '@node-rs/argon2';
import pg from 'pg';

const { Client } = pg;

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/knu_roommate?schema=public';
const DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
const SEED_PASSWORD = '1q2w3e4r';

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizeNickname(nickname) {
  return nickname.trim().toLowerCase();
}

const quietLifestyle = {
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
  screenTolerance: 'NO_SCREEN',
  indoorEatingTolerance: 'NO_SMELL',
  cleanExpectation: 'BASIC',
  drinkingTolerance: 'LOW_ONLY',
};

const tidyLifestyle = {
  bedtime: '24_02',
  wakeTime: '09_10',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'SENSITIVE',
  smokingBehavior: 'NO',
  indoorEating: 'RARELY',
  phoneBehavior: 'RARELY',
  earphoneUsage: 'MOSTLY_SPEAKER',
  cleanLevel: 'WEEKLY_3_UP',
  drinkingFrequency: 'NONE',
  relationshipStyle: 'CASUAL',
  temperatureSensitivity: 'COLD',
  smokingTolerance: 'NO_ONLY',
  phoneTolerance: 'OUTSIDE_ONLY',
  earphoneExpectation: 'MUST',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'NO_SCREEN',
  indoorEatingTolerance: 'NO_SMELL',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
};

const relaxedLifestyle = {
  bedtime: '24_02',
  wakeTime: '09_10',
  sleepHabit: 'NONE',
  sleepEnvironment: 'EARPHONE',
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

const flexibleLifestyle = {
  bedtime: 'BEFORE_22',
  wakeTime: 'BEFORE_07',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'SENSITIVE',
  smokingBehavior: 'NO',
  indoorEating: 'RARELY',
  phoneBehavior: 'RARELY',
  earphoneUsage: 'MOSTLY',
  cleanLevel: 'WEEKLY_3_UP',
  drinkingFrequency: 'NONE',
  relationshipStyle: 'CASUAL',
  temperatureSensitivity: 'COLD',
  smokingTolerance: 'NO_ONLY',
  phoneTolerance: 'OUTSIDE_ONLY',
  earphoneExpectation: 'MUST',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'NO_SCREEN',
  indoorEatingTolerance: 'NO_SMELL',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
};

const seedUsers = [
  {
    key: 'primary-login',
    email: 'test@kangwon.ac.kr',
    nickname: '테스트춘천남',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'toegye',
    intro: '춘천 운영캠퍼스 남성 시드 계정입니다.',
    note: '기본 로그인/운영캠퍼스 남성 검증',
    lifestyle: quietLifestyle,
  },
  {
    key: 'operated-female',
    email: 'test-f@kangwon.ac.kr',
    nickname: '테스트춘천여',
    gender: 'F',
    campus: 'CHUNCHEON',
    dormitoryId: 'yeji',
    intro: '춘천 운영캠퍼스 여성 시드 계정입니다.',
    note: '운영캠퍼스 여성 검증',
    lifestyle: tidyLifestyle,
  },
  {
    key: 'samcheok-male',
    email: 'test-samcheok-m@kangwon.ac.kr',
    nickname: '테스트삼척남',
    gender: 'M',
    campus: 'SAMCHEOK',
    dormitoryId: null,
    intro: '삼척 비운영캠퍼스 남성 시드 계정입니다.',
    note: '비운영캠퍼스 남성 검증',
    lifestyle: relaxedLifestyle,
  },
  {
    key: 'samcheok-female',
    email: 'test-samcheok-f@kangwon.ac.kr',
    nickname: '테스트삼척여',
    gender: 'F',
    campus: 'SAMCHEOK',
    dormitoryId: null,
    intro: '삼척 비운영캠퍼스 여성 시드 계정입니다.',
    note: '비운영캠퍼스 여성 검증',
    lifestyle: tidyLifestyle,
  },
  {
    key: 'dogye-male',
    email: 'test-dogye-m@kangwon.ac.kr',
    nickname: '테스트도계남',
    gender: 'M',
    campus: 'DOGYE',
    dormitoryId: null,
    intro: '도계 비운영캠퍼스 남성 시드 계정입니다.',
    note: '도계 남성 검증',
    lifestyle: relaxedLifestyle,
  },
  {
    key: 'dogye-female',
    email: 'test-dogye-f@kangwon.ac.kr',
    nickname: '테스트도계여',
    gender: 'F',
    campus: 'DOGYE',
    dormitoryId: null,
    intro: '도계 비운영캠퍼스 여성 시드 계정입니다.',
    note: '도계 여성 검증',
    lifestyle: flexibleLifestyle,
  },
  {
    key: 'duplicate-email',
    email: 'existing-email@kangwon.ac.kr',
    nickname: '이메일중복',
    gender: 'M',
    campus: 'CHUNCHEON',
    dormitoryId: 'dasan',
    intro: '이미 가입된 이메일 예외 검증용 계정입니다.',
    note: '회원가입 시 이미 가입된 이메일 예외 확인',
    lifestyle: quietLifestyle,
  },
  {
    key: 'duplicate-nickname',
    email: 'nickname-holder@kangwon.ac.kr',
    nickname: '중복닉테스트',
    gender: 'F',
    campus: 'CHUNCHEON',
    dormitoryId: 'gukji',
    intro: '이미 사용 중인 닉네임 예외 검증용 계정입니다.',
    note: '회원가입 시 이미 사용 중인 닉네임 예외 확인',
    lifestyle: tidyLifestyle,
  },
];

async function seed() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    const passwordHash = await argonHash(SEED_PASSWORD, {
      algorithm: 2,
      memoryCost: 8192,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });

    for (const seedUser of seedUsers) {
      const emailNormalized = normalizeEmail(seedUser.email);
      const nicknameNormalized = normalizeNickname(seedUser.nickname);

      const existing = await client.query(
        `
          SELECT id
          FROM "User"
          WHERE "emailNormalized" = $1 OR "nicknameNormalized" = $2
          ORDER BY CASE WHEN "emailNormalized" = $1 THEN 0 ELSE 1 END
          LIMIT 1
        `,
        [emailNormalized, nicknameNormalized],
      );

      const values = [
        seedUser.email,
        emailNormalized,
        passwordHash,
        seedUser.nickname,
        nicknameNormalized,
        seedUser.gender,
        seedUser.campus,
        JSON.stringify(seedUser.lifestyle),
        seedUser.intro,
        seedUser.dormitoryId,
      ];

      if (existing.rowCount && existing.rows[0]?.id) {
        await client.query(
          `
            UPDATE "User"
            SET
              email = $1,
              "emailNormalized" = $2,
              "passwordHash" = $3,
              nickname = $4,
              "nicknameNormalized" = $5,
              gender = $6::"Gender",
              campus = $7::"Campus",
              lifestyle = $8::jsonb,
              intro = $9,
              "dormitoryId" = $10,
              "emailVerifiedAt" = NOW(),
              "updatedAt" = NOW()
            WHERE id = $11
          `,
          [...values, existing.rows[0].id],
        );
        continue;
      }

      await client.query(
        `
          INSERT INTO "User" (
            id,
            email,
            "emailNormalized",
            "passwordHash",
            nickname,
            "nicknameNormalized",
            gender,
            campus,
            lifestyle,
            intro,
            "dormitoryId",
            "emailVerifiedAt",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7::"Gender", $8::"Campus", $9::jsonb, $10, $11, NOW(), NOW(), NOW()
          )
        `,
        [randomUUID(), ...values],
      );
    }

    console.log('\n[seed] auth seed users ready');
    console.table(
      seedUsers.map((user) => ({
        key: user.key,
        email: user.email,
        password: SEED_PASSWORD,
        nickname: user.nickname,
        gender: user.gender,
        campus: user.campus,
        dormitoryId: user.dormitoryId ?? 'null',
        note: user.note,
      })),
    );
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error('[seed] failed', error);
  process.exitCode = 1;
});
