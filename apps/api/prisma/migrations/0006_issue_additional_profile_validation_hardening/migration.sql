ALTER TABLE "UserProfile"
  ADD CONSTRAINT "UserProfile_grade_check"
  CHECK ("grade" IS NULL OR "grade" IN ('1', '2', '3', '4+'));

ALTER TABLE "SeasonParticipantProfile"
  ADD CONSTRAINT "SeasonParticipantProfile_grade_check"
  CHECK ("grade" IS NULL OR "grade" IN ('1', '2', '3', '4+'));

ALTER TABLE "UserProfile"
  ADD CONSTRAINT "UserProfile_birthYear_check"
  CHECK ("birthYear" IS NULL OR "birthYear" >= 1980);

ALTER TABLE "SeasonParticipantProfile"
  ADD CONSTRAINT "SeasonParticipantProfile_birthYear_check"
  CHECK ("birthYear" IS NULL OR "birthYear" >= 1980);
