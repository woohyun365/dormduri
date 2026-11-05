-- @param {String} $1:param1
-- @param {String} $2:param2
SELECT
  conversation."id" AS "threadId",
  CASE
    WHEN conversation."participantAId" = $2 THEN conversation."participantBId"
    ELSE conversation."participantAId"
  END AS "targetParticipantId",
  conversation."threadKind",
  conversation."status",
  conversation."lastMessageAt"
FROM "ConversationThread" AS conversation
INNER JOIN "ConversationThreadMember" AS viewer_member
  ON viewer_member."threadId" = conversation."id"
  AND viewer_member."participantId" = $2
  AND viewer_member."memberState" = 'ACTIVE'::"ConversationThreadMemberState"
INNER JOIN "ConversationThreadMember" AS target_member
  ON target_member."threadId" = conversation."id"
  AND target_member."participantId" = CASE
    WHEN conversation."participantAId" = $2 THEN conversation."participantBId"
    ELSE conversation."participantAId"
  END
  AND target_member."memberState" = 'ACTIVE'::"ConversationThreadMemberState"
WHERE conversation."seasonId" = $1
  AND conversation."status" = 'OPEN'::"ConversationThreadStatus"
  AND (
    (
      conversation."participantAId" = $2
      AND conversation."participantBId" = ANY($3::text[])
    )
    OR (
      conversation."participantBId" = $2
      AND conversation."participantAId" = ANY($3::text[])
    )
  )
ORDER BY COALESCE(conversation."lastMessageAt", conversation."createdAt") DESC,
  conversation."id" DESC;
