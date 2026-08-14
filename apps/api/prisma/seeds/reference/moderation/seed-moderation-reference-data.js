import { validateModerationReferenceData } from './moderation-reference-data.js';

export async function seedModerationReferenceData(client) {
  const rows = validateModerationReferenceData();

  for (const row of rows) {
    await client.query(
      `
        UPDATE "ModerationTerm"
        SET
          term = $2,
          source = 'REFERENCE'::"ModerationTermSource",
          "referenceKey" = $1,
          "isActive" = $7,
          "updatedAt" = NOW()
        WHERE (source = 'REFERENCE'::"ModerationTermSource" OR "referenceKey" IS NULL)
          AND "normalizedTerm" = $3
          AND category = $4::"ModerationTermCategory"
          AND "matchMode" = $5::"ModerationMatchMode"
          AND surface = $6::"ModerationSurface"
      `,
      [
        row.referenceKey,
        row.term,
        row.normalizedTerm,
        row.category,
        row.matchMode,
        row.surface,
        row.isActive,
      ],
    );

    await client.query(
      `
        INSERT INTO "ModerationTerm" (
          id,
          term,
          "normalizedTerm",
          category,
          "matchMode",
          surface,
          source,
          "referenceKey",
          "isActive",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          gen_random_uuid()::text,
          $2,
          $3,
          $4::"ModerationTermCategory",
          $5::"ModerationMatchMode",
          $6::"ModerationSurface",
          'REFERENCE'::"ModerationTermSource",
          $1,
          $7,
          NOW(),
          NOW()
        )
        ON CONFLICT ("referenceKey")
        DO UPDATE SET
          term = EXCLUDED.term,
          "normalizedTerm" = EXCLUDED."normalizedTerm",
          category = EXCLUDED.category,
          "matchMode" = EXCLUDED."matchMode",
          surface = EXCLUDED.surface,
          source = 'REFERENCE'::"ModerationTermSource",
          "isActive" = EXCLUDED."isActive",
          "updatedAt" = NOW()
      `,
      [
        row.referenceKey,
        row.term,
        row.normalizedTerm,
        row.category,
        row.matchMode,
        row.surface,
        row.isActive,
      ],
    );
  }

  const referenceKeys = rows.map((row) => row.referenceKey);
  const deactivated = await client.query(
    `
      UPDATE "ModerationTerm"
      SET
        "isActive" = FALSE,
        "updatedAt" = NOW()
      WHERE source = 'REFERENCE'::"ModerationTermSource"
        AND NOT ("referenceKey" = ANY($1::text[]))
        AND "isActive" = TRUE
    `,
    [referenceKeys],
  );

  return {
    moderationTerms: rows.length,
    deactivatedModerationTerms: deactivated.rowCount ?? 0,
  };
}
