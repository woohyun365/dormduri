import { DORMITORY_REFERENCE_DATA } from './dormitory-reference-data.js';
import { seedCampusReferenceData } from '../common/seed-campus-reference-data.js';

export async function seedDormitoryReferenceData(client) {
  await seedCampusReferenceData(client);

  for (const dormitory of DORMITORY_REFERENCE_DATA) {
    await client.query(
      `
        INSERT INTO "Dormitory" (
          id,
          "campusCode",
          "nameKo",
          "roomType",
          "genderPolicy",
          "matchingSupported",
          "isActive",
          "sortOrder",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          $1,
          $2::"Campus",
          $3,
          $4,
          $5::"DormitoryGenderPolicy",
          $6,
          $7,
          $8,
          NOW(),
          NOW()
        )
        ON CONFLICT (id)
        DO UPDATE SET
          "campusCode" = EXCLUDED."campusCode",
          "nameKo" = EXCLUDED."nameKo",
          "roomType" = EXCLUDED."roomType",
          "genderPolicy" = EXCLUDED."genderPolicy",
          "matchingSupported" = EXCLUDED."matchingSupported",
          "isActive" = EXCLUDED."isActive",
          "sortOrder" = EXCLUDED."sortOrder",
          "updatedAt" = NOW()
      `,
      [
        dormitory.id,
        dormitory.campusCode,
        dormitory.nameKo,
        dormitory.roomType,
        dormitory.genderPolicy,
        dormitory.matchingSupported,
        dormitory.isActive,
        dormitory.sortOrder,
      ],
    );
  }

  const canonicalIds = DORMITORY_REFERENCE_DATA.map((dormitory) => dormitory.id);
  await client.query(
    `
      UPDATE "Dormitory"
      SET
        "isActive" = FALSE,
        "matchingSupported" = FALSE,
        "updatedAt" = NOW()
      WHERE NOT (id = ANY($1::text[]))
        AND ("isActive" = TRUE OR "matchingSupported" = TRUE)
    `,
    [canonicalIds],
  );

  return {
    campuses: 3,
    dormitories: DORMITORY_REFERENCE_DATA.length,
    matchingDormitories: DORMITORY_REFERENCE_DATA.filter((dormitory) => dormitory.matchingSupported)
      .length,
  };
}
