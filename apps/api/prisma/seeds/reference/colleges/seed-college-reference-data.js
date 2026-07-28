import { COLLEGE_REFERENCE_DATA } from './college-reference-data.js';
import { seedCampusReferenceData } from '../common/seed-campus-reference-data.js';

export async function seedCollegeReferenceData(client) {
  await seedCampusReferenceData(client);

  for (const college of COLLEGE_REFERENCE_DATA) {
    await client.query(
      `
        UPDATE "CollegeMaster" AS legacy
        SET
          code = $1,
          "updatedAt" = NOW()
        WHERE legacy."campusCode" = $2::"Campus"
          AND legacy."nameKo" = $3
          AND legacy.code <> $1
          AND NOT EXISTS (
            SELECT 1
            FROM "CollegeMaster" AS canonical
            WHERE canonical.code = $1
          )
      `,
      [college.code, college.campusCode, college.nameKo],
    );

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

  const canonicalCodes = COLLEGE_REFERENCE_DATA.map((college) => college.code);
  await client.query(
    `
      UPDATE "CollegeMaster"
      SET
        "isActive" = FALSE,
        "updatedAt" = NOW()
      WHERE NOT (code = ANY($1::text[]))
        AND "isActive" = TRUE
    `,
    [canonicalCodes],
  );

  return {
    campuses: 3,
    colleges: COLLEGE_REFERENCE_DATA.length,
  };
}
