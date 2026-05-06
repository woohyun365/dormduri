UPDATE "ConversationThread"
SET "status" = 'ARCHIVED'
WHERE "status"::text = 'CLOSED';

DROP INDEX IF EXISTS "ConversationThread_seasonId_pairKey_live_key";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ConversationThreadStatus_old'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_type WHERE typname = 'ConversationThreadStatus'
    ) THEN
      CREATE TYPE "ConversationThreadStatus" AS ENUM ('OPEN', 'READ_ONLY', 'ARCHIVED');
    END IF;
  ELSE
    ALTER TYPE "ConversationThreadStatus" RENAME TO "ConversationThreadStatus_old";
    CREATE TYPE "ConversationThreadStatus" AS ENUM ('OPEN', 'READ_ONLY', 'ARCHIVED');
  END IF;
END $$;

ALTER TABLE "ConversationThread"
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "ConversationThreadStatus"
USING ("status"::text::"ConversationThreadStatus");

ALTER TABLE "ConversationThread"
ALTER COLUMN "status" SET DEFAULT 'OPEN';

DROP TYPE IF EXISTS "ConversationThreadStatus_old";

CREATE UNIQUE INDEX IF NOT EXISTS "ConversationThread_seasonId_pairKey_live_key"
ON "ConversationThread"("seasonId", "pairKey")
WHERE "status" <> 'ARCHIVED';
