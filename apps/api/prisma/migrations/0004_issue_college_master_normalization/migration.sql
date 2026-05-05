CREATE TABLE "CollegeMaster" (
    "code" TEXT NOT NULL,
    "campusCode" "Campus" NOT NULL,
    "nameKo" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollegeMaster_pkey" PRIMARY KEY ("code")
);

ALTER TABLE "UserProfile" ADD COLUMN "collegeCode" TEXT;
ALTER TABLE "SeasonParticipantProfile" ADD COLUMN "collegeCode" TEXT;

CREATE UNIQUE INDEX "CollegeMaster_campusCode_nameKo_key" ON "CollegeMaster"("campusCode", "nameKo");
CREATE INDEX "CollegeMaster_campusCode_sortOrder_idx" ON "CollegeMaster"("campusCode", "sortOrder");
CREATE INDEX "UserProfile_collegeCode_idx" ON "UserProfile"("collegeCode");
CREATE INDEX "SeasonParticipantProfile_collegeCode_idx" ON "SeasonParticipantProfile"("collegeCode");

ALTER TABLE "CollegeMaster" ADD CONSTRAINT "CollegeMaster_campusCode_fkey" FOREIGN KEY ("campusCode") REFERENCES "CampusMaster"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_collegeCode_fkey" FOREIGN KEY ("collegeCode") REFERENCES "CollegeMaster"("code") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SeasonParticipantProfile" ADD CONSTRAINT "SeasonParticipantProfile_collegeCode_fkey" FOREIGN KEY ("collegeCode") REFERENCES "CollegeMaster"("code") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "CollegeMaster" (
    "code",
    "campusCode",
    "nameKo",
    "sortOrder",
    "isActive",
    "createdAt",
    "updatedAt"
)
VALUES
    ('IT', 'CHUNCHEON', 'IT대', 1, true, NOW(), NOW()),
    ('NURSING', 'CHUNCHEON', '간호대', 2, true, NOW(), NOW()),
    ('BUSINESS', 'CHUNCHEON', '경영대', 3, true, NOW(), NOW()),
    ('AGRICULTURE_LIFE', 'CHUNCHEON', '농업생명대', 4, true, NOW(), NOW()),
    ('ANIMAL_LIFE', 'CHUNCHEON', '동물생명대', 5, true, NOW(), NOW()),
    ('ARTS_ENGINEERING', 'CHUNCHEON', '문화예술·공대', 6, true, NOW(), NOW()),
    ('EDUCATION', 'CHUNCHEON', '사범대', 7, true, NOW(), NOW()),
    ('SOCIAL_SCIENCES', 'CHUNCHEON', '사회과학대', 8, true, NOW(), NOW()),
    ('FOREST_ENVIRONMENT', 'CHUNCHEON', '산림환경대', 9, true, NOW(), NOW()),
    ('MEDICINE_PHARMACY_VETERINARY', 'CHUNCHEON', '의·약·수의대', 10, true, NOW(), NOW()),
    ('BIOMEDICAL_SCIENCE', 'CHUNCHEON', '의생명과학대', 11, true, NOW(), NOW()),
    ('HUMANITIES', 'CHUNCHEON', '인문대', 12, true, NOW(), NOW()),
    ('NATURAL_SCIENCES', 'CHUNCHEON', '자연과학대', 13, true, NOW(), NOW()),
    ('OPEN_MAJOR', 'CHUNCHEON', '자유전공', 14, true, NOW(), NOW());

UPDATE "UserProfile"
SET "collegeCode" = CASE college
    WHEN 'IT대' THEN 'IT'
    WHEN '간호대' THEN 'NURSING'
    WHEN '경영대' THEN 'BUSINESS'
    WHEN '농업생명대' THEN 'AGRICULTURE_LIFE'
    WHEN '동물생명대' THEN 'ANIMAL_LIFE'
    WHEN '문화예술·공대' THEN 'ARTS_ENGINEERING'
    WHEN '공대' THEN 'ARTS_ENGINEERING'
    WHEN '사범대' THEN 'EDUCATION'
    WHEN '사회과학대' THEN 'SOCIAL_SCIENCES'
    WHEN '산림환경대' THEN 'FOREST_ENVIRONMENT'
    WHEN '의·약·수의대' THEN 'MEDICINE_PHARMACY_VETERINARY'
    WHEN '의생명과학대' THEN 'BIOMEDICAL_SCIENCE'
    WHEN '인문대' THEN 'HUMANITIES'
    WHEN '문과대' THEN 'HUMANITIES'
    WHEN '자연과학대' THEN 'NATURAL_SCIENCES'
    WHEN '자유전공' THEN 'OPEN_MAJOR'
    ELSE NULL
END
WHERE college IS NOT NULL;

UPDATE "SeasonParticipantProfile"
SET "collegeCode" = CASE college
    WHEN 'IT대' THEN 'IT'
    WHEN '간호대' THEN 'NURSING'
    WHEN '경영대' THEN 'BUSINESS'
    WHEN '농업생명대' THEN 'AGRICULTURE_LIFE'
    WHEN '동물생명대' THEN 'ANIMAL_LIFE'
    WHEN '문화예술·공대' THEN 'ARTS_ENGINEERING'
    WHEN '공대' THEN 'ARTS_ENGINEERING'
    WHEN '사범대' THEN 'EDUCATION'
    WHEN '사회과학대' THEN 'SOCIAL_SCIENCES'
    WHEN '산림환경대' THEN 'FOREST_ENVIRONMENT'
    WHEN '의·약·수의대' THEN 'MEDICINE_PHARMACY_VETERINARY'
    WHEN '의생명과학대' THEN 'BIOMEDICAL_SCIENCE'
    WHEN '인문대' THEN 'HUMANITIES'
    WHEN '문과대' THEN 'HUMANITIES'
    WHEN '자연과학대' THEN 'NATURAL_SCIENCES'
    WHEN '자유전공' THEN 'OPEN_MAJOR'
    ELSE NULL
END
WHERE college IS NOT NULL;
