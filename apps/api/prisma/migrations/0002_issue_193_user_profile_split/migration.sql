-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "nicknameNormalized" TEXT NOT NULL,
    "nicknameChangedAt" TIMESTAMPTZ(3),
    "lifestyle" JSONB NOT NULL,
    "intro" TEXT NOT NULL DEFAULT '',
    "messageToRoommate" TEXT,
    "college" TEXT,
    "grade" TEXT,
    "mbti" TEXT,
    "birthYear" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- Backfill existing current profile data from User
INSERT INTO "UserProfile" (
    "userId",
    "nickname",
    "nicknameNormalized",
    "nicknameChangedAt",
    "lifestyle",
    "intro",
    "messageToRoommate",
    "college",
    "grade",
    "mbti",
    "birthYear",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "nickname",
    "nicknameNormalized",
    NULL,
    "lifestyle",
    "intro",
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    "createdAt",
    "updatedAt"
FROM "User";

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_nicknameNormalized_key" ON "UserProfile"("nicknameNormalized");

-- CreateIndex
CREATE INDEX "UserProfile_nickname_idx" ON "UserProfile"("nickname");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop legacy current-profile columns from User after backfill
DROP INDEX "User_nicknameNormalized_key";

ALTER TABLE "User"
    DROP COLUMN "nickname",
    DROP COLUMN "nicknameNormalized",
    DROP COLUMN "lifestyle",
    DROP COLUMN "intro";
