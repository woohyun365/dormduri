ALTER TYPE "SeasonOverrideState" RENAME VALUE 'SEASON_PREPARATION' TO 'SEASON_OPEN';

CREATE TYPE "SeasonParticipationIntent" AS ENUM ('UNDECIDED', 'REGISTERED', 'DECLINED');
CREATE TYPE "ParticipantStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'ACTIVE', 'MATCHED', 'WITHDRAWN', 'EXPIRED');
CREATE TYPE "ParticipantHiddenReasonCode" AS ENUM ('POLICY_VIOLATION', 'SAFETY_REVIEW', 'ADMIN_REQUEST', 'OTHER');

CREATE TABLE "SeasonParticipant" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "participationIntent" "SeasonParticipationIntent" NOT NULL DEFAULT 'UNDECIDED',
    "registeredAt" TIMESTAMPTZ(3),
    "declinedAt" TIMESTAMPTZ(3),
    "dormitoryId" TEXT,
    "dormitorySelectionState" "DormitorySelectionState" NOT NULL DEFAULT 'NOT_SELECTED',
    "participantStatus" "ParticipantStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "campusCodeSnapshot" "Campus" NOT NULL,
    "genderSnapshot" "Gender" NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMPTZ(3),
    "matchedAt" TIMESTAMPTZ(3),
    "withdrawnAt" TIMESTAMPTZ(3),
    "expiredAt" TIMESTAMPTZ(3),
    "hiddenByAdminAt" TIMESTAMPTZ(3),
    "hiddenReasonCode" "ParticipantHiddenReasonCode",
    "hiddenReasonDetail" TEXT,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeasonParticipantProfile" (
    "participantId" TEXT NOT NULL,
    "nicknameSnapshot" TEXT NOT NULL,
    "nicknameNormalizedSnapshot" TEXT NOT NULL,
    "lifestyle" JSONB NOT NULL,
    "intro" TEXT NOT NULL DEFAULT '',
    "messageToRoommate" TEXT,
    "college" TEXT,
    "grade" TEXT,
    "mbti" TEXT,
    "birthYear" INTEGER,
    "templateSourceUserProfileUpdatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonParticipantProfile_pkey" PRIMARY KEY ("participantId")
);

CREATE UNIQUE INDEX "SeasonParticipant_seasonId_userId_key" ON "SeasonParticipant"("seasonId", "userId");
CREATE INDEX "SeasonParticipant_userId_seasonId_idx" ON "SeasonParticipant"("userId", "seasonId");
CREATE INDEX "SeasonParticipant_seasonId_dormitoryId_dormitorySelectionState_idx" ON "SeasonParticipant"("seasonId", "dormitoryId", "dormitorySelectionState");
CREATE INDEX "SeasonParticipant_seasonId_participantStatus_idx" ON "SeasonParticipant"("seasonId", "participantStatus");
CREATE INDEX "SeasonParticipantProfile_nicknameNormalizedSnapshot_idx" ON "SeasonParticipantProfile"("nicknameNormalizedSnapshot");

ALTER TABLE "SeasonParticipant" ADD CONSTRAINT "SeasonParticipant_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonParticipant" ADD CONSTRAINT "SeasonParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SeasonParticipant" ADD CONSTRAINT "SeasonParticipant_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES "Dormitory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeasonParticipantProfile" ADD CONSTRAINT "SeasonParticipantProfile_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
