import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hash as argonHash } from '@node-rs/argon2';
import {
  CAMPUS_GUIDE_CONTENT_DATA,
  CAMPUS_MASTER_DATA,
  DORMITORY_GUIDE_DATA,
  DORMITORY_MASTER_DATA,
} from './seed-data/reference/dormitory-seed-data.js';
import { COLLEGE_MASTER_DATA } from './seed-data/reference/college-reference-data.js';
import { MODERATION_REFERENCE_ROWS } from './seed-data/reference/moderation-seed-data.js';
import {
  AUTH_FIXTURE_SEED_PASSWORD,
  AUTH_FIXTURE_USERS,
} from './seed-data/fixtures/auth-fixture-users.js';
import { SEASON_FIXTURES } from './seed-data/fixtures/season-fixtures.js';
import { getCollegeLabel } from '@repo/shared/college-contract';
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

function normalizeCollegeSeedValue(college) {
  if (!college) {
    return null;
  }

  const collegeLabel = getCollegeLabel(college);
  if (!collegeLabel) {
    throw new Error(`Unknown college seed value: ${college}`);
  }

  return college;
}

/**
 * @param {string} dateStr
 * @param {number} weeks
 */
function weeksBeforeDate(dateStr, weeks) {
  const [yearPart, monthPart, dayPart] = dateStr.split('-');
  const year = Number.parseInt(yearPart ?? '0', 10);
  const month = Number.parseInt(monthPart ?? '1', 10);
  const day = Number.parseInt(dayPart ?? '1', 10);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - weeks * 7);
  return date.toISOString().slice(0, 10);
}

function getSemesterDefaults(academicYear, semester) {
  if (semester === 1) {
    return {
      preparationStartDate: `${academicYear}-01-01`,
      seasonEndDate: `${academicYear}-02-28`,
    };
  }

  return {
    preparationStartDate: `${academicYear}-07-01`,
    seasonEndDate: `${academicYear}-08-31`,
  };
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

async function seedColleges(client) {
  for (const college of COLLEGE_MASTER_DATA) {
    await client.query(
      `
        INSERT INTO "CollegeMaster" (
          code,
          "campusCode",
          "nameKo",
          "sortOrder",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2::"Campus", $3, $4, $5, NOW(), NOW())
        ON CONFLICT (code)
        DO UPDATE SET
          "campusCode" = EXCLUDED."campusCode",
          "nameKo" = EXCLUDED."nameKo",
          "sortOrder" = EXCLUDED."sortOrder",
          "isActive" = EXCLUDED."isActive",
          "updatedAt" = NOW()
      `,
      [college.code, college.campusCode, college.nameKo, college.sortOrder, college.isActive],
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
    const earliestRoomSelectionDate = [...(season.dormitoryOperations ?? [])]
      .filter((operation) => operation.isOperated !== false)
      .map((operation) => operation.roomSelectionDate)
      .sort()[0];

    if (!earliestRoomSelectionDate) {
      throw new Error(
        `Season fixture requires at least one operated dormitory: ${season.campusCode} ${season.academicYear}-${season.semester}`,
      );
    }

    const defaults = getSemesterDefaults(season.academicYear, season.semester);
    const preparationStartDate = season.preparationStartDate ?? defaults.preparationStartDate;
    const matchingStartDate =
      season.matchingStartDate ?? weeksBeforeDate(earliestRoomSelectionDate, 2);
    const seasonEndDate = season.seasonEndDate ?? defaults.seasonEndDate;
    await client.query(
      `
        INSERT INTO "Season" (
          id,
          "campusCode",
          "academicYear",
          semester,
          name,
          "preparationStartDate",
          "matchingStartDate",
          "seasonEndDate",
          "overrideState",
          "overrideReason",
          "overrideStartedAt",
          "overrideEndsAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          gen_random_uuid()::text,
          $1::"Campus",
          $2,
          $3,
          $4,
          $5::date,
          $6::date,
          $7::date,
          $8::"SeasonOverrideState",
          $9,
          $10::timestamptz,
          $11::timestamptz,
          NOW(),
          NOW()
        )
        ON CONFLICT ("campusCode", "academicYear", semester)
        DO UPDATE SET
          name = EXCLUDED.name,
          "campusCode" = EXCLUDED."campusCode",
          "preparationStartDate" = EXCLUDED."preparationStartDate",
          "matchingStartDate" = EXCLUDED."matchingStartDate",
          "seasonEndDate" = EXCLUDED."seasonEndDate",
          "overrideState" = EXCLUDED."overrideState",
          "overrideReason" = EXCLUDED."overrideReason",
          "overrideStartedAt" = EXCLUDED."overrideStartedAt",
          "overrideEndsAt" = EXCLUDED."overrideEndsAt",
          "updatedAt" = NOW()
      `,
      [
        season.campusCode,
        season.academicYear,
        season.semester,
        season.name,
        preparationStartDate,
        matchingStartDate,
        seasonEndDate,
        season.overrideState ?? null,
        season.overrideReason ?? null,
        season.overrideStartedAt ?? null,
        season.overrideEndsAt ?? null,
      ],
    );

    const seasonRow = await client.query(
      `
        SELECT id
        FROM "Season"
        WHERE "campusCode" = $1::"Campus"
          AND "academicYear" = $2
          AND semester = $3
        LIMIT 1
      `,
      [season.campusCode, season.academicYear, season.semester],
    );

    const seasonId = seasonRow.rows[0]?.id;
    if (!seasonId) {
      throw new Error(
        `Season seed lookup failed: ${season.campusCode} ${season.academicYear}-${season.semester}`,
      );
    }

    for (const operation of season.dormitoryOperations ?? []) {
      await client.query(
        `
          INSERT INTO "SeasonDormitoryOperation" (
            "seasonId",
            "dormitoryId",
            "isOperated",
            "roomSelectionDate",
            "createdAt",
            "updatedAt"
          )
          VALUES ($1, $2, $3, $4::date, NOW(), NOW())
          ON CONFLICT ("seasonId", "dormitoryId")
          DO UPDATE SET
            "isOperated" = EXCLUDED."isOperated",
            "roomSelectionDate" = EXCLUDED."roomSelectionDate",
            "updatedAt" = NOW()
        `,
        [
          seasonId,
          operation.dormitoryId,
          operation.isOperated ?? true,
          operation.roomSelectionDate,
        ],
      );
    }

    const dormitoryOperations = season.dormitoryOperations ?? [];
    if (dormitoryOperations.length > 0) {
      const dormitoryIds = dormitoryOperations.map((operation) => operation.dormitoryId);
      await client.query(
        `
          DELETE FROM "SeasonDormitoryOperation"
          WHERE "seasonId" = $1
            AND NOT ("dormitoryId" = ANY($2::text[]))
        `,
        [seasonId, dormitoryIds],
      );
    } else {
      await client.query(
        `
          DELETE FROM "SeasonDormitoryOperation"
          WHERE "seasonId" = $1
        `,
        [seasonId],
      );
    }
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
    const collegeCode = normalizeCollegeSeedValue(seedUser.college ?? null);

    const existing = await client.query(
      `
        SELECT id
        FROM "User"
        WHERE "emailNormalized" = $1
        LIMIT 1
      `,
      [emailNormalized],
    );

    const values = [
      seedUser.email,
      emailNormalized,
      passwordHash,
      seedUser.gender,
      seedUser.campus,
      seedUser.dormitoryId,
      seedUser.dormitorySelectionState,
    ];

    const profileValues = [
      seedUser.nickname,
      nicknameNormalized,
      JSON.stringify(seedUser.lifestyle),
      seedUser.intro,
      seedUser.messageToRoommate ?? null,
      collegeCode,
      seedUser.grade ?? null,
      seedUser.mbti ?? null,
      seedUser.birthYear ?? null,
    ];

    if (existing.rowCount && existing.rows[0]?.id) {
      await client.query(
        `
          UPDATE "User"
          SET
            email = $1,
            "emailNormalized" = $2,
            "passwordHash" = $3,
            gender = $4::"Gender",
            campus = $5::"Campus",
            "dormitoryId" = $6,
            "dormitorySelectionState" = $7::"DormitorySelectionState",
            "emailVerifiedAt" = NOW(),
            "updatedAt" = NOW()
          WHERE id = $8
        `,
        [...values, existing.rows[0].id],
      );
      await client.query(
        `
          INSERT INTO "UserProfile" (
            "userId",
            nickname,
            "nicknameNormalized",
            lifestyle,
            intro,
            "messageToRoommate",
            "collegeCode",
            grade,
            mbti,
            "birthYear",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, NOW(), NOW()
          )
          ON CONFLICT ("userId")
          DO UPDATE SET
            nickname = EXCLUDED.nickname,
            "nicknameNormalized" = EXCLUDED."nicknameNormalized",
            lifestyle = EXCLUDED.lifestyle,
            intro = EXCLUDED.intro,
            "messageToRoommate" = EXCLUDED."messageToRoommate",
            "collegeCode" = EXCLUDED."collegeCode",
            grade = EXCLUDED.grade,
            mbti = EXCLUDED.mbti,
            "birthYear" = EXCLUDED."birthYear",
            "updatedAt" = NOW()
        `,
        [existing.rows[0].id, ...profileValues],
      );
      continue;
    }

    const userId = randomUUID();

    await client.query(
      `
        INSERT INTO "User" (
          id,
          email,
          "emailNormalized",
          "passwordHash",
          gender,
          campus,
          "dormitoryId",
          "dormitorySelectionState",
          "emailVerifiedAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4, $5::"Gender", $6::"Campus", $7, $8::"DormitorySelectionState", NOW(), NOW(), NOW()
        )
      `,
      [userId, ...values],
    );

    await client.query(
      `
        INSERT INTO "UserProfile" (
          "userId",
          nickname,
          "nicknameNormalized",
          lifestyle,
          intro,
          "messageToRoommate",
          "collegeCode",
          grade,
          mbti,
          "birthYear",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, NOW(), NOW()
        )
      `,
      [userId, ...profileValues],
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
    await seedColleges(client);
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
