
DROP INDEX IF EXISTS "ConversationThread_seasonId_pairKey_key";
CREATE INDEX IF NOT EXISTS "ConversationThread_seasonId_pairKey_status_idx"
ON "ConversationThread"("seasonId", "pairKey", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationThread_seasonId_pairKey_live_key"
ON "ConversationThread"("seasonId", "pairKey")
WHERE "status" <> 'ARCHIVED';
