-- Members who can still receive mail, the one value backoffice_runtime reads from the user side
-- (db.md db.integrity.role-separation, legal plan D-LC8). A significant or reconsent legal version is
-- approved only while it is 0 (Owner 2026-11-17 Q6, 2026-11-25 L2a Q7).
SELECT "recipientCount"
FROM "LegalNoticeRecipientCount"
