SELECT id
FROM "ActiveMatch"
WHERE id = $1
FOR UPDATE;
