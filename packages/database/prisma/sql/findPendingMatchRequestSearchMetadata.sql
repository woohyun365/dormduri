-- @param {String} $1:param1
-- @param {String} $2:param2
SELECT
  request."id",
  CASE
    WHEN request."requesterParticipantId" = $2 THEN request."receiverParticipantId"
    ELSE request."requesterParticipantId"
  END AS "targetParticipantId",
  CASE
    WHEN request."requesterParticipantId" = $2 THEN 'SENT'
    ELSE 'RECEIVED'
  END AS "direction",
  request."createdAt",
  request."expiresAt"
FROM "MatchRequest" AS request
WHERE request."seasonId" = $1
  AND request."status" = 'PENDING'::"MatchRequestStatus"
  AND request."expiresAt" > $4
  AND (
    (
      request."requesterParticipantId" = $2
      AND request."receiverParticipantId" = ANY($3::text[])
    )
    OR (
      request."receiverParticipantId" = $2
      AND request."requesterParticipantId" = ANY($3::text[])
    )
  )
ORDER BY request."createdAt" DESC, request."id" DESC;
