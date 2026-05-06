CREATE TYPE "ConversationThreadKind" AS ENUM ('DIRECT', 'MATCHED');
CREATE TYPE "ConversationThreadStatus" AS ENUM ('OPEN', 'READ_ONLY', 'ARCHIVED', 'CLOSED');
CREATE TYPE "ConversationThreadClosedReason" AS ENUM (
    'ACTIVE_MATCH_CREATED',
    'ROOM_SELECTION_CUTOFF',
    'SEASON_ENDED',
    'PARTICIPANT_WITHDRAWN',
    'MODERATION',
    'ADMIN_ACTION'
);
CREATE TYPE "ConversationThreadMemberState" AS ENUM ('ACTIVE', 'LEFT');

CREATE TABLE "ConversationThread" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "participantAId" TEXT NOT NULL,
    "participantBId" TEXT NOT NULL,
    "openedByParticipantId" TEXT NOT NULL,
    "threadKind" "ConversationThreadKind" NOT NULL,
    "activeMatchId" TEXT,
    "status" "ConversationThreadStatus" NOT NULL DEFAULT 'OPEN',
    "closedReason" "ConversationThreadClosedReason",
    "closedAt" TIMESTAMPTZ(3),
    "lastMessageAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConversationThreadMember" (
    "threadId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "memberState" "ConversationThreadMemberState" NOT NULL DEFAULT 'ACTIVE',
    "leftAt" TIMESTAMPTZ(3),
    "mutedAt" TIMESTAMPTZ(3),
    "lastReadAt" TIMESTAMPTZ(3),
    "lastVisibleAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationThreadMember_pkey" PRIMARY KEY ("threadId", "participantId")
);

CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderParticipantId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConversationThread_seasonId_pairKey_status_idx"
ON "ConversationThread"("seasonId", "pairKey", "status");
CREATE UNIQUE INDEX "ConversationThread_seasonId_pairKey_live_key"
ON "ConversationThread"("seasonId", "pairKey")
WHERE "status" <> 'ARCHIVED';
CREATE UNIQUE INDEX "ConversationThread_activeMatchId_key"
ON "ConversationThread"("activeMatchId");
CREATE INDEX "ConversationThread_participantAId_idx" ON "ConversationThread"("participantAId");
CREATE INDEX "ConversationThread_participantBId_idx" ON "ConversationThread"("participantBId");
CREATE INDEX "ConversationMessage_threadId_sentAt_idx" ON "ConversationMessage"("threadId", "sentAt");
CREATE INDEX "ConversationMessage_senderParticipantId_sentAt_idx" ON "ConversationMessage"("senderParticipantId", "sentAt");

ALTER TABLE "ConversationThread"
ADD CONSTRAINT "ConversationThread_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationThread"
ADD CONSTRAINT "ConversationThread_participantAId_fkey"
FOREIGN KEY ("participantAId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationThread"
ADD CONSTRAINT "ConversationThread_participantBId_fkey"
FOREIGN KEY ("participantBId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationThread"
ADD CONSTRAINT "ConversationThread_openedByParticipantId_fkey"
FOREIGN KEY ("openedByParticipantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationThread"
ADD CONSTRAINT "ConversationThread_activeMatchId_fkey"
FOREIGN KEY ("activeMatchId") REFERENCES "ActiveMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationThreadMember"
ADD CONSTRAINT "ConversationThreadMember_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "ConversationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationThreadMember"
ADD CONSTRAINT "ConversationThreadMember_participantId_fkey"
FOREIGN KEY ("participantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage"
ADD CONSTRAINT "ConversationMessage_threadId_fkey"
FOREIGN KEY ("threadId") REFERENCES "ConversationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationMessage"
ADD CONSTRAINT "ConversationMessage_senderParticipantId_fkey"
FOREIGN KEY ("senderParticipantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
