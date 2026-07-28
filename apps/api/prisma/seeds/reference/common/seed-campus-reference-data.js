import { CAMPUS_REFERENCE_DATA } from './campus-reference-data.js';

export async function seedCampusReferenceData(client) {
  for (const campus of CAMPUS_REFERENCE_DATA) {
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

  return { campuses: CAMPUS_REFERENCE_DATA.length };
}
