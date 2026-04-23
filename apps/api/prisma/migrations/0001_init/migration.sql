-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "Campus" AS ENUM ('CHUNCHEON', 'SAMCHEOK', 'DOGYE');

-- CreateEnum
CREATE TYPE "VerificationCodePurpose" AS ENUM ('SIGNUP', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "ModerationTermCategory" AS ENUM ('BLOCKED_TEXT', 'RESERVED_NICKNAME');

-- CreateEnum
CREATE TYPE "ModerationMatchMode" AS ENUM ('EXACT', 'INCLUDES');

-- CreateEnum
CREATE TYPE "ModerationSurface" AS ENUM ('ALL', 'NICKNAME', 'INTRO');

-- CreateEnum
CREATE TYPE "DormitorySelectionState" AS ENUM ('NOT_SELECTED', 'UNASSIGNED', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "DormitoryGenderPolicy" AS ENUM ('M', 'F', 'BOTH');

-- CreateEnum
CREATE TYPE "DormitoryBathroomType" AS ENUM ('SHARED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SeasonOverrideState" AS ENUM ('OFF_SEASON', 'SEASON_PREPARATION', 'SEASON_MATCHING', 'SEASON_POST_MATCH');

-- CreateTable
CREATE TABLE "CampusMaster" (
    "code" "Campus" NOT NULL,
    "nameKo" TEXT NOT NULL,
    "isOperated" BOOLEAN NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampusMaster_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "CampusGuideContent" (
    "campusCode" "Campus" NOT NULL,
    "homepageUrl" TEXT NOT NULL,
    "commonRules" JSONB NOT NULL,
    "emergencyContacts" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampusGuideContent_pkey" PRIMARY KEY ("campusCode")
);

-- CreateTable
CREATE TABLE "Dormitory" (
    "id" TEXT NOT NULL,
    "campusCode" "Campus" NOT NULL,
    "nameKo" TEXT NOT NULL,
    "roomType" INTEGER NOT NULL,
    "genderPolicy" "DormitoryGenderPolicy" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dormitory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DormitoryGuide" (
    "dormitoryId" TEXT NOT NULL,
    "bathroomType" "DormitoryBathroomType" NOT NULL,
    "facilities" JSONB NOT NULL,
    "repairContact" TEXT NOT NULL,
    "diningContact" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DormitoryGuide_pkey" PRIMARY KEY ("dormitoryId")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "campusCode" "Campus" NOT NULL DEFAULT 'CHUNCHEON',
    "academicYear" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "preparationStartDate" DATE NOT NULL,
    "matchingStartDate" DATE NOT NULL,
    "seasonEndDate" DATE NOT NULL,
    "overrideState" "SeasonOverrideState",
    "overrideReason" TEXT,
    "overrideStartedAt" TIMESTAMPTZ(3),
    "overrideEndsAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonDormitoryOperation" (
    "seasonId" TEXT NOT NULL,
    "dormitoryId" TEXT NOT NULL,
    "isOperated" BOOLEAN NOT NULL DEFAULT true,
    "roomSelectionDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonDormitoryOperation_pkey" PRIMARY KEY ("seasonId","dormitoryId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "nicknameNormalized" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "campus" "Campus" NOT NULL,
    "lifestyle" JSONB NOT NULL,
    "intro" TEXT NOT NULL DEFAULT '',
    "dormitoryId" TEXT,
    "dormitorySelectionState" "DormitorySelectionState" NOT NULL DEFAULT 'NOT_SELECTED',
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "lastFailedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "purpose" "VerificationCodePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3),
    "consumedAt" TIMESTAMPTZ(3),
    "requestIp" TEXT,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCodeRequestLog" (
    "id" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "purpose" "VerificationCodePurpose" NOT NULL,
    "requestIp" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCodeRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "refreshTokenHash" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationTerm" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "normalizedTerm" TEXT NOT NULL,
    "category" "ModerationTermCategory" NOT NULL,
    "matchMode" "ModerationMatchMode" NOT NULL,
    "surface" "ModerationSurface" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dormitory_campusCode_genderPolicy_sortOrder_idx" ON "Dormitory"("campusCode", "genderPolicy", "sortOrder");

-- CreateIndex
CREATE INDEX "Season_campusCode_matchingStartDate_idx" ON "Season"("campusCode", "matchingStartDate");

-- CreateIndex
CREATE INDEX "Season_campusCode_seasonEndDate_idx" ON "Season"("campusCode", "seasonEndDate");

-- CreateIndex
CREATE UNIQUE INDEX "Season_campusCode_academicYear_semester_key" ON "Season"("campusCode", "academicYear", "semester");

-- CreateIndex
CREATE INDEX "SeasonDormitoryOperation_seasonId_isOperated_roomSelectionD_idx" ON "SeasonDormitoryOperation"("seasonId", "isOperated", "roomSelectionDate");

-- CreateIndex
CREATE INDEX "SeasonDormitoryOperation_dormitoryId_roomSelectionDate_idx" ON "SeasonDormitoryOperation"("dormitoryId", "roomSelectionDate");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "User_nicknameNormalized_key" ON "User"("nicknameNormalized");

-- CreateIndex
CREATE INDEX "User_campus_dormitorySelectionState_idx" ON "User"("campus", "dormitorySelectionState");

-- CreateIndex
CREATE INDEX "User_dormitoryId_idx" ON "User"("dormitoryId");

-- CreateIndex
CREATE UNIQUE INDEX "LoginAttempt_emailNormalized_key" ON "LoginAttempt"("emailNormalized");

-- CreateIndex
CREATE INDEX "VerificationCode_emailNormalized_purpose_idx" ON "VerificationCode"("emailNormalized", "purpose");

-- CreateIndex
CREATE INDEX "VerificationCodeRequestLog_emailNormalized_purpose_requestI_idx" ON "VerificationCodeRequestLog"("emailNormalized", "purpose", "requestIp", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationCodeRequestLog_requestIp_createdAt_idx" ON "VerificationCodeRequestLog"("requestIp", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "ModerationTerm_surface_category_isActive_idx" ON "ModerationTerm"("surface", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationTerm_normalizedTerm_category_matchMode_surface_key" ON "ModerationTerm"("normalizedTerm", "category", "matchMode", "surface");

-- AddForeignKey
ALTER TABLE "CampusGuideContent" ADD CONSTRAINT "CampusGuideContent_campusCode_fkey" FOREIGN KEY ("campusCode") REFERENCES "CampusMaster"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dormitory" ADD CONSTRAINT "Dormitory_campusCode_fkey" FOREIGN KEY ("campusCode") REFERENCES "CampusMaster"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DormitoryGuide" ADD CONSTRAINT "DormitoryGuide_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES "Dormitory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_campusCode_fkey" FOREIGN KEY ("campusCode") REFERENCES "CampusMaster"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDormitoryOperation" ADD CONSTRAINT "SeasonDormitoryOperation_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDormitoryOperation" ADD CONSTRAINT "SeasonDormitoryOperation_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES "Dormitory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES "Dormitory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateFunction
CREATE OR REPLACE FUNCTION set_current_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- CreateTrigger
CREATE TRIGGER set_user_updated_at
BEFORE UPDATE ON "User"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp();

-- CreateTrigger
CREATE TRIGGER set_login_attempt_updated_at
BEFORE UPDATE ON "LoginAttempt"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp();

-- CreateTrigger
CREATE TRIGGER set_auth_session_updated_at
BEFORE UPDATE ON "AuthSession"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp();

-- CreateTrigger
CREATE TRIGGER set_moderation_term_updated_at
BEFORE UPDATE ON "ModerationTerm"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp();

-- CreateTrigger
CREATE TRIGGER set_campus_master_updated_at
BEFORE UPDATE ON "CampusMaster"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp();

-- CreateTrigger
CREATE TRIGGER set_campus_guide_content_updated_at
BEFORE UPDATE ON "CampusGuideContent"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp();

-- CreateTrigger
CREATE TRIGGER set_dormitory_updated_at
BEFORE UPDATE ON "Dormitory"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp();

-- CreateTrigger
CREATE TRIGGER set_dormitory_guide_updated_at
BEFORE UPDATE ON "DormitoryGuide"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp();

-- CreateTrigger
CREATE TRIGGER set_season_updated_at
BEFORE UPDATE ON "Season"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp();

-- CreateTrigger
CREATE TRIGGER set_season_dormitory_operation_updated_at
BEFORE UPDATE ON "SeasonDormitoryOperation"
FOR EACH ROW
EXECUTE FUNCTION set_current_timestamp();
