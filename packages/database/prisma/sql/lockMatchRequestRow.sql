SELECT id
FROM "MatchRequest"
WHERE id = $1
FOR UPDATE;
