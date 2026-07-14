-- @param {String} $1:param1
-- @param {String} $2:param2
SELECT
  request."receiverParticipantId" AS "targetParticipantId",
  COUNT(*)::int AS "directionCount"
FROM "MatchRequest" AS request
WHERE request."seasonId" = $1
  AND request."requesterParticipantId" = $2
  AND request."receiverParticipantId" = ANY($3::text[])
GROUP BY request."receiverParticipantId"
HAVING COUNT(*) >= 5
ORDER BY request."receiverParticipantId" ASC;
