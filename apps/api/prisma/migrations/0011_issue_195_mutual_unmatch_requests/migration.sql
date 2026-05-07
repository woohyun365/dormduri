CREATE TYPE "ActiveMatchUnmatchRequestStatus" AS ENUM (
    'PENDING',
    'CANCELLED_BY_REQUESTER',
    'EXPIRED_BY_CUTOFF',
    'FULFILLED_BY_MUTUAL_CONSENT'
);

CREATE TABLE "ActiveMatchUnmatchRequest" (
    "id" TEXT NOT NULL,
    "activeMatchId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "ActiveMatchUnmatchRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminalAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveMatchUnmatchRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActiveMatchUnmatchRequest_activeMatchId_status_requestedAt_idx"
ON "ActiveMatchUnmatchRequest"("activeMatchId", "status", "requestedAt");

CREATE INDEX "ActiveMatchUnmatchRequest_participantId_status_requestedAt_idx"
ON "ActiveMatchUnmatchRequest"("participantId", "status", "requestedAt");

CREATE UNIQUE INDEX "ActiveMatchUnmatchRequest_activeMatchId_participantId_pending_key"
ON "ActiveMatchUnmatchRequest"("activeMatchId", "participantId")
WHERE "status" = 'PENDING';

ALTER TABLE "ActiveMatchUnmatchRequest"
ADD CONSTRAINT "ActiveMatchUnmatchRequest_activeMatchId_fkey"
FOREIGN KEY ("activeMatchId") REFERENCES "ActiveMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActiveMatchUnmatchRequest"
ADD CONSTRAINT "ActiveMatchUnmatchRequest_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ActiveMatch"
DROP CONSTRAINT IF EXISTS "ActiveMatch_cancelRequestedByParticipantId_fkey";

ALTER TABLE "ActiveMatch"
DROP COLUMN IF EXISTS "cancelRequestedByParticipantId",
DROP COLUMN IF EXISTS "cancelRequestedAt";
