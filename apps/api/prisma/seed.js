import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { hash as argonHash } from '@node-rs/argon2';
import { seedDormitoryReferenceData } from './seeds/reference/dormitories/seed-dormitory-reference-data.js';
import { seedCollegeReferenceData } from './seeds/reference/colleges/seed-college-reference-data.js';
import { seedModerationReferenceData } from './seeds/reference/moderation/seed-moderation-reference-data.js';
import { SUPPORT_FAQ_REFERENCE_ROWS } from './seed-data/reference/support-faq-seed-data.js';
import { LEGAL_DOCUMENT_REFERENCE_ROWS } from './seed-data/reference/legal-document-seed-data.js';
import {
  AUTH_FIXTURE_SEED_PASSWORD,
  AUTH_FIXTURE_USERS,
} from './seed-data/fixtures/auth-fixture-users.js';
import { seedHomeDashboardE2eFixtures } from './seed-data/fixtures/home-dashboard-e2e-fixtures.js';
import { SEASON_FIXTURES } from './seed-data/fixtures/season-fixtures.js';
import { getCollegeLabel } from '@repo/shared/college';
import pg from 'pg';

const { Client } = pg;

const DEFAULT_DATABASE_URL =
  'postgresql://knu_dev:knu_dev_password@localhost:5432/knu_roommate?schema=public';
const DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
const DEFAULT_AUTH_FIXTURE_COLLEGE_CODE = 'CHUNCHEON_IT';
const DEFAULT_AUTH_FIXTURE_BIRTH_YEAR = 2002;

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

async function seedSupportFaq(client) {
  for (const row of SUPPORT_FAQ_REFERENCE_ROWS) {
    await client.query(
      `
        INSERT INTO "SupportFaqArticle" (
          id,
          category,
          question,
          answer,
          published,
          "sortOrder",
          "createdAt",
          "updatedAt"
        )
        VALUES ($1, $2::"SupportTicketCategory", $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (id)
        DO UPDATE SET
          category = EXCLUDED.category,
          question = EXCLUDED.question,
          answer = EXCLUDED.answer,
          published = EXCLUDED.published,
          "sortOrder" = EXCLUDED."sortOrder",
          "updatedAt" = NOW()
      `,
      [row.id, row.category, row.question, row.answer, row.published, row.sortOrder],
    );

    for (const placement of row.placements ?? []) {
      await client.query(
        `
          INSERT INTO "SupportFaqPlacement" (
            id,
            "articleId",
            surface,
            "sortOrder",
            "createdAt",
            "updatedAt"
          )
          VALUES (gen_random_uuid()::text, $1, $2::"SupportFaqSurface", $3, NOW(), NOW())
          ON CONFLICT ("articleId", surface)
          DO UPDATE SET
            "sortOrder" = EXCLUDED."sortOrder",
            "updatedAt" = NOW()
        `,
        [row.id, placement.surface, placement.sortOrder],
      );
    }
  }
}

async function seedLegalDocuments(client) {
  for (const row of LEGAL_DOCUMENT_REFERENCE_ROWS) {
    await client.query(
      `
        INSERT INTO "LegalDocumentVersion" (
          id,
          kind,
          version,
          title,
          "summaryItems",
          sections,
          "changeSummary",
          "publishedAt",
          "effectiveAt",
          "retiredAt",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          $1,
          $2::"LegalDocumentKind",
          $3,
          $4,
          $5::jsonb,
          $6::jsonb,
          $7,
          $8::timestamptz,
          $9::timestamptz,
          $10::timestamptz,
          NOW(),
          NOW()
        )
        ON CONFLICT (id)
        DO UPDATE SET
          kind = EXCLUDED.kind,
          version = EXCLUDED.version,
          title = EXCLUDED.title,
          "summaryItems" = EXCLUDED."summaryItems",
          sections = EXCLUDED.sections,
          "changeSummary" = EXCLUDED."changeSummary",
          "publishedAt" = EXCLUDED."publishedAt",
          "effectiveAt" = EXCLUDED."effectiveAt",
          "retiredAt" = EXCLUDED."retiredAt",
          "updatedAt" = NOW()
      `,
      [
        row.id,
        row.kind,
        row.version,
        row.title,
        JSON.stringify(row.summaryItems),
        JSON.stringify(row.sections),
        row.changeSummary ?? null,
        row.publishedAt ?? null,
        row.effectiveAt,
        row.retiredAt ?? null,
      ],
    );
  }
}

async function seedUserAccountIdentities(
  client,
  { userId, nickname, nicknameNormalized, collegeCode, birthYear },
) {
  if (!collegeCode) {
    throw new Error(`Auth fixture user requires college identity: ${userId}`);
  }

  await client.query(
    `
      INSERT INTO "UserDisplayIdentity" (
        "userId",
        nickname,
        "nicknameNormalized",
        "nicknameChangedAt",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, NULL, NOW(), NOW())
      ON CONFLICT ("userId")
      DO UPDATE SET
        nickname = EXCLUDED.nickname,
        "nicknameNormalized" = EXCLUDED."nicknameNormalized",
        "updatedAt" = NOW()
    `,
    [userId, nickname, nicknameNormalized],
  );

  await client.query(
    `
      INSERT INTO "UserAcademicIdentity" (
        "userId",
        "collegeCode",
        "birthYear",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT ("userId")
      DO UPDATE SET
        "collegeCode" = EXCLUDED."collegeCode",
        "birthYear" = EXCLUDED."birthYear",
        "updatedAt" = NOW()
    `,
    [userId, collegeCode, birthYear],
  );
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
    const collegeCode = normalizeCollegeSeedValue(
      seedUser.college ?? DEFAULT_AUTH_FIXTURE_COLLEGE_CODE,
    );
    const birthYear = seedUser.birthYear ?? DEFAULT_AUTH_FIXTURE_BIRTH_YEAR;

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
    ];
    const userId = existing.rows[0]?.id ?? randomUUID();

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
            "emailVerifiedAt" = NOW(),
            "deletedAt" = NULL,
            "updatedAt" = NOW()
          WHERE id = $6
        `,
        [...values, userId],
      );
    } else {
      await client.query(
        `
          INSERT INTO "User" (
            id,
            email,
            "emailNormalized",
            "passwordHash",
            gender,
            campus,
            "emailVerifiedAt",
            "createdAt",
            "updatedAt"
          )
          VALUES ($1, $2, $3, $4, $5::"Gender", $6::"Campus", NOW(), NOW(), NOW())
        `,
        [userId, ...values],
      );
    }

    await seedUserAccountIdentities(client, {
      userId,
      nickname: seedUser.nickname,
      nicknameNormalized,
      collegeCode,
      birthYear,
    });
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
    await seedDormitoryReferenceData(client);
    await seedCollegeReferenceData(client);
    await seedModerationReferenceData(client);
    await seedSupportFaq(client);
    await seedLegalDocuments(client);
    await seedSeasons(client);
    await seedUsersData(client);
    await seedHomeDashboardE2eFixtures(client);
  } finally {
    await client.end();
  }
}

seed().catch((error) => {
  console.error('[seed] failed', error);
  process.exitCode = 1;
});
