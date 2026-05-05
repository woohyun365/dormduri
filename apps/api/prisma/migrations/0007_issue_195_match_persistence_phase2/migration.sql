CREATE TYPE "MatchRequestStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'CANCELLED_BY_REQUESTER',
    'CANCELLED_BY_SYSTEM',
    'EXPIRED'
);

CREATE TYPE "MatchRequestTerminalReason" AS ENUM (
    'ACCEPTED',
    'REJECTED_BY_RECEIVER',
    'CANCELLED_BY_REQUESTER',
    'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
    'EXPIRED',
    'WITHDRAWN_PARTICIPANT',
    'ADMIN_ACTION'
);

CREATE TYPE "MatchRequestChannel" AS ENUM (
    'ROOMMATE_TAB',
    'PROFILE_DETAIL',
    'RECOMMENDATION',
    'ADMIN'
);

CREATE TYPE "ActiveMatchStatus" AS ENUM (
    'ACTIVE',
    'UNMATCHED',
    'SEASON_ENDED',
    'ADMIN_ENDED'
);

CREATE TYPE "ActiveMatchEndReason" AS ENUM (
    'UNMATCHED_BY_MUTUAL_CONSENT',
    'SEASON_ENDED',
    'ADMIN_ACTION',
    'WITHDRAWN_PARTICIPANT'
);

CREATE TABLE "MatchRequest" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "pairMinParticipantId" TEXT NOT NULL,
    "pairMaxParticipantId" TEXT NOT NULL,
    "requesterParticipantId" TEXT NOT NULL,
    "receiverParticipantId" TEXT NOT NULL,
    "note" TEXT,
    "status" "MatchRequestStatus" NOT NULL DEFAULT 'PENDING',
    "terminalReason" "MatchRequestTerminalReason",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "terminalAt" TIMESTAMPTZ(3),
    "acceptedAt" TIMESTAMPTZ(3),
    "requestChannel" "MatchRequestChannel",

    CONSTRAINT "MatchRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActiveMatch" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "participantAId" TEXT NOT NULL,
    "participantBId" TEXT NOT NULL,
    "createdFromRequestId" TEXT NOT NULL,
    "status" "ActiveMatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),
    "endReason" "ActiveMatchEndReason",
    "cancelRequestedByParticipantId" TEXT,
    "cancelRequestedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveMatch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActiveMatch_createdFromRequestId_key" UNIQUE ("createdFromRequestId")
);

CREATE INDEX "MatchRequest_seasonId_requesterParticipantId_receiverParticipantId_createdAt_idx"
ON "MatchRequest"("seasonId", "requesterParticipantId", "receiverParticipantId", "createdAt");
CREATE INDEX "MatchRequest_seasonId_receiverParticipantId_status_idx"
ON "MatchRequest"("seasonId", "receiverParticipantId", "status");
CREATE INDEX "MatchRequest_expiresAt_status_idx"
ON "MatchRequest"("expiresAt", "status");
CREATE INDEX "MatchRequest_seasonId_pairKey_status_idx"
ON "MatchRequest"("seasonId", "pairKey", "status");
CREATE UNIQUE INDEX "MatchRequest_seasonId_pairMinParticipantId_pairMaxParticipantId_pending_key"
ON "MatchRequest"("seasonId", "pairMinParticipantId", "pairMaxParticipantId")
WHERE "status" = 'PENDING';

CREATE INDEX "ActiveMatch_seasonId_pairKey_endedAt_idx"
ON "ActiveMatch"("seasonId", "pairKey", "endedAt");
CREATE INDEX "ActiveMatch_participantAId_endedAt_idx"
ON "ActiveMatch"("participantAId", "endedAt");
CREATE INDEX "ActiveMatch_participantBId_endedAt_idx"
ON "ActiveMatch"("participantBId", "endedAt");
CREATE INDEX "ActiveMatch_seasonId_status_endedAt_idx"
ON "ActiveMatch"("seasonId", "status", "endedAt");
CREATE UNIQUE INDEX "ActiveMatch_seasonId_pairKey_live_key"
ON "ActiveMatch"("seasonId", "pairKey")
WHERE "endedAt" IS NULL;

ALTER TABLE "MatchRequest"
ADD CONSTRAINT "MatchRequest_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchRequest"
ADD CONSTRAINT "MatchRequest_requesterParticipantId_fkey"
FOREIGN KEY ("requesterParticipantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchRequest"
ADD CONSTRAINT "MatchRequest_receiverParticipantId_fkey"
FOREIGN KEY ("receiverParticipantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActiveMatch"
ADD CONSTRAINT "ActiveMatch_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActiveMatch"
ADD CONSTRAINT "ActiveMatch_participantAId_fkey"
FOREIGN KEY ("participantAId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActiveMatch"
ADD CONSTRAINT "ActiveMatch_participantBId_fkey"
FOREIGN KEY ("participantBId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActiveMatch"
ADD CONSTRAINT "ActiveMatch_createdFromRequestId_fkey"
FOREIGN KEY ("createdFromRequestId") REFERENCES "MatchRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActiveMatch"
ADD CONSTRAINT "ActiveMatch_cancelRequestedByParticipantId_fkey"
FOREIGN KEY ("cancelRequestedByParticipantId") REFERENCES "SeasonParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
