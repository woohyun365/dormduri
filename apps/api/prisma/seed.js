import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hash as argonHash } from '@node-rs/argon2';
import {
  CAMPUS_GUIDE_CONTENT_DATA,
  CAMPUS_MASTER_DATA,
  DORMITORY_GUIDE_DATA,
  DORMITORY_MASTER_DATA,
} from './seed-data/reference/dormitory-seed-data.js';
import { MODERATION_REFERENCE_ROWS } from './seed-data/reference/moderation-seed-data.js';
import {
  AUTH_FIXTURE_SEED_PASSWORD,
  AUTH_FIXTURE_USERS,
} from './seed-data/fixtures/auth-fixture-users.js';
import { SEASON_FIXTURES } from './seed-data/fixtures/season-fixtures.js';
import pg from 'pg';

const { Client } = pg;

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/knu_roommate?schema=public';
const DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizeNickname(nickname) {
  return nickname.trim().toLowerCase();
}

async function seedCampusAndDormitories(client) {
  for (const campus of CAMPUS_MASTER_DATA) {
    await client.query(
      `
        INSERT INTO "CampusMaster" (
          code,
          "nameKo",
          "isOperated",
          "sortOrder",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1::"Campus", $2, $3, $4, NOW(), NOW())
        ON CONFLICT (code)
        DO UPDATE SET
          "nameKo" = EXCLUDED."nameKo",
          "isOperated" = EXCLUDED."isOperated",
          "sortOrder" = EXCLUDED."sortOrder",
          "updatedAt" = NOW()
      `,
      [campus.code, campus.nameKo, campus.isOperated, campus.sortOrder],
    );
  }

  for (const guideContent of CAMPUS_GUIDE_CONTENT_DATA) {
    await client.query(
      `
        INSERT INTO "CampusGuideContent" (
          "campusCode",
          "homepageUrl",
          "commonRules",
          "emergencyContacts",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1::"Campus", $2, $3::jsonb, $4::jsonb, NOW(), NOW())
        ON CONFLICT ("campusCode")
        DO UPDATE SET
          "homepageUrl" = EXCLUDED."homepageUrl",
          "commonRules" = EXCLUDED."commonRules",
          "emergencyContacts" = EXCLUDED."emergencyContacts",
          "updatedAt" = NOW()
      `,
      [
        guideContent.campusCode,
        guideContent.homepageUrl,
        JSON.stringify(guideContent.commonRules),
        JSON.stringify(guideContent.emergencyContacts),
      ],
    );
  }

  for (const dormitory of DORMITORY_MASTER_DATA) {
    await client.query(
      `
        INSERT INTO "Dormitory" (
          id,
          "campusCode",
          "nameKo",
          "roomType",
          "genderPolicy",
          "sortOrder",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2::"Campus", $3, $4, $5::"DormitoryGenderPolicy", $6, NOW(), NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          "campusCode" = EXCLUDED."campusCode",
          "nameKo" = EXCLUDED."nameKo",
          "roomType" = EXCLUDED."roomType",
          "genderPolicy" = EXCLUDED."genderPolicy",
          "sortOrder" = EXCLUDED."sortOrder",
          "updatedAt" = NOW()
      `,
      [
        dormitory.id,
        dormitory.campusCode,
        dormitory.nameKo,
        dormitory.roomType,
        dormitory.genderPolicy,
        dormitory.sortOrder,
      ],
    );
  }

  for (const [dormitoryId, guide] of Object.entries(DORMITORY_GUIDE_DATA)) {
    await client.query(
      `
        INSERT INTO "DormitoryGuide" (
          "dormitoryId",
          "bathroomType",
          facilities,
          "repairContact",
          "diningContact",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2::"DormitoryBathroomType", $3::jsonb, $4, $5, NOW(), NOW())
        ON CONFLICT ("dormitoryId")
        DO UPDATE SET
          "bathroomType" = EXCLUDED."bathroomType",
          facilities = EXCLUDED.facilities,
          "repairContact" = EXCLUDED."repairContact",
          "diningContact" = EXCLUDED."diningContact",
          "updatedAt" = NOW()
      `,
      [
        dormitoryId,
        guide.bathroomType,
        JSON.stringify(guide.facilities),
        guide.repairContact,
        guide.diningContact,
      ],
    );
  }
}

async function seedModerationTerms(client) {
  for (const row of MODERATION_REFERENCE_ROWS) {
    await client.query(
      `
        INSERT INTO "ModerationTerm" (
          id,
          term,
          "normalizedTerm",
          category,
          "matchMode",
          surface,
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          gen_random_uuid()::text,
          $1,
          $2,
          $3::"ModerationTermCategory",
          $4::"ModerationMatchMode",
          $5::"ModerationSurface",
          $6,
          NOW(),
          NOW()
        )
        ON CONFLICT ("normalizedTerm", category, "matchMode", surface)
        DO NOTHING
      `,
      [row.term, row.normalizedTerm, row.category, row.matchMode, row.surface, row.isActive],
    );
  }
}

async function seedSeasons(client) {
  for (const season of SEASON_FIXTURES) {
    await client.query(
      `
        INSERT INTO "Season" (
          id,
          "academicYear",
          semester,
          name,
          "roomSelectionDate",
          "createdAt",
          "updatedAt"
        )
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4::date, NOW(), NOW())
        ON CONFLICT ("academicYear", semester)
        DO UPDATE SET
          name = EXCLUDED.name,
          "roomSelectionDate" = EXCLUDED."roomSelectionDate",
          "updatedAt" = NOW()
      `,
      [season.academicYear, season.semester, season.name, season.roomSelectionDate],
    );
  }
}

async function seedUsersData(client) {
  const passwordHash = await argonHash(AUTH_FIXTURE_SEED_PASSWORD, {
    algorithm: 2,
    memoryCost: 8192,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });

  for (const seedUser of AUTH_FIXTURE_USERS) {
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
      seedUser.dormitorySelectionState,
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
            "dormitorySelectionState" = $11::"DormitorySelectionState",
            "emailVerifiedAt" = NOW(),
            "updatedAt" = NOW()
          WHERE id = $12
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
          "dormitorySelectionState",
          "emailVerifiedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7::"Gender", $8::"Campus", $9::jsonb, $10, $11, $12::"DormitorySelectionState", NOW(), NOW(), NOW()
        )
      `,
      [randomUUID(), ...values],
    );
  }

  console.log('\n[seed] auth seed users ready');
  console.table(
    AUTH_FIXTURE_USERS.map((user) => ({
      key: user.key,
      email: user.email,
      password: AUTH_FIXTURE_SEED_PASSWORD,
      nickname: user.nickname,
      gender: user.gender,
      campus: user.campus,
      dormitoryId: user.dormitoryId ?? 'null',
      dormitorySelectionState: user.dormitorySelectionState,
      note: user.note,
    })),
  );
}

async function seed() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await seedCampusAndDormitories(client);
    await seedModerationTerms(client);
    await seedSeasons(client);
    await seedUsersData(client);
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error('[seed] failed', error);
  process.exitCode = 1;
});
