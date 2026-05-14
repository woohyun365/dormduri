-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "Campus" AS ENUM ('CHUNCHEON', 'SAMCHEOK', 'DOGYE');

-- CreateEnum
CREATE TYPE "VerificationCodePurpose" AS ENUM ('SIGNUP', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "ModerationTermCategory" AS ENUM ('BLOCKED_TEXT', 'RESERVED_NICKNAME');

-- CreateEnum
CREATE TYPE "ModerationMatchMode" AS ENUM ('EXACT', 'INCLUDES');

-- CreateEnum
CREATE TYPE "ModerationSurface" AS ENUM ('ALL', 'NICKNAME', 'INTRO');

-- CreateEnum
CREATE TYPE "DormitorySelectionState" AS ENUM ('NOT_SELECTED', 'UNASSIGNED', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "DormitoryGenderPolicy" AS ENUM ('M', 'F', 'BOTH');

-- CreateEnum
CREATE TYPE "DormitoryBathroomType" AS ENUM ('SHARED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SeasonOverrideState" AS ENUM ('OFF_SEASON', 'SEASON_OPEN', 'SEASON_MATCHING', 'SEASON_POST_MATCH');

-- CreateEnum
CREATE TYPE "SeasonParticipationIntent" AS ENUM ('UNDECIDED', 'REGISTERED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'ACTIVE', 'MATCHED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ParticipantHiddenReasonCode" AS ENUM ('POLICY_VIOLATION', 'SAFETY_REVIEW', 'ADMIN_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "MatchRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED_BY_REQUESTER', 'CANCELLED_BY_SYSTEM', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MatchRequestTerminalReason" AS ENUM ('ACCEPTED', 'REJECTED_BY_RECEIVER', 'CANCELLED_BY_REQUESTER', 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH', 'EXPIRED', 'WITHDRAWN_PARTICIPANT', 'ADMIN_ACTION');

-- CreateEnum
CREATE TYPE "MatchRequestChannel" AS ENUM ('ROOMMATE_TAB', 'PROFILE_DETAIL', 'RECOMMENDATION', 'ADMIN');

-- CreateEnum
CREATE TYPE "ActiveMatchStatus" AS ENUM ('ACTIVE', 'UNMATCHED', 'SEASON_ENDED', 'ADMIN_ENDED');

-- CreateEnum
CREATE TYPE "ActiveMatchEndReason" AS ENUM ('UNMATCHED_BY_MUTUAL_CONSENT', 'SEASON_ENDED', 'ADMIN_ACTION', 'WITHDRAWN_PARTICIPANT');

-- CreateEnum
CREATE TYPE "ActiveMatchUnmatchRequestStatus" AS ENUM ('PENDING', 'CANCELLED_BY_REQUESTER', 'EXPIRED_BY_CUTOFF', 'FULFILLED_BY_MUTUAL_CONSENT');

-- CreateEnum
CREATE TYPE "SeasonMatchHistoryEntryType" AS ENUM ('REQUEST', 'MATCH');

-- CreateEnum
CREATE TYPE "SeasonMatchHistoryEntryResult" AS ENUM ('REQUEST_REJECTED', 'REQUEST_CANCELLED', 'REQUEST_EXPIRED', 'MATCHED_SUCCESS', 'UNMATCHED_AFTER_SUCCESS');

-- CreateEnum
CREATE TYPE "ConversationThreadKind" AS ENUM ('DIRECT', 'MATCHED');

-- CreateEnum
CREATE TYPE "ConversationThreadStatus" AS ENUM ('OPEN', 'READ_ONLY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConversationThreadClosedReason" AS ENUM ('ACTIVE_MATCH_CREATED', 'ROOM_SELECTION_CUTOFF', 'SEASON_ENDED', 'PARTICIPANT_WITHDRAWN', 'MODERATION', 'ADMIN_ACTION');

-- CreateEnum
CREATE TYPE "ConversationThreadMemberState" AS ENUM ('ACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "LifestyleBedtime" AS ENUM ('BEFORE_22', '22_24', '24_02', 'AFTER_02');

-- CreateEnum
CREATE TYPE "LifestyleWakeTime" AS ENUM ('BEFORE_07', '07_08', '08_09', '09_10', 'AFTER_10', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "LifestyleSleepHabit" AS ENUM ('NONE', 'TALKING', 'SNORING', 'GRINDING');

-- CreateEnum
CREATE TYPE "LifestyleSleepEnvironment" AS ENUM ('QUIET', 'EARPHONE', 'LOW_SPEAKER');

-- CreateEnum
CREATE TYPE "LifestyleScreenUsage" AS ENUM ('NONE', 'AUDIO', 'SCREEN');

-- CreateEnum
CREATE TYPE "LifestyleNoiseSensitivity" AS ENUM ('SENSITIVE', 'NORMAL', 'DEEP');

-- CreateEnum
CREATE TYPE "LifestyleSmokingBehavior" AS ENUM ('NO', 'E_CIG', 'YES');

-- CreateEnum
CREATE TYPE "LifestyleIndoorEating" AS ENUM ('RARELY', 'SNACK', 'MEAL');

-- CreateEnum
CREATE TYPE "LifestylePhoneBehavior" AS ENUM ('RARELY', 'SOMETIMES', 'OFTEN');

-- CreateEnum
CREATE TYPE "LifestyleEarphoneUsage" AS ENUM ('ALWAYS', 'MOSTLY', 'MOSTLY_SPEAKER', 'ALWAYS_SPEAKER');

-- CreateEnum
CREATE TYPE "LifestyleCleanLevel" AS ENUM ('WHEN_DIRTY', 'WEEKLY_1_2', 'WEEKLY_3_UP');

-- CreateEnum
CREATE TYPE "LifestyleDrinkingFrequency" AS ENUM ('NONE', 'RARELY', 'SOMETIMES', 'OFTEN');

-- CreateEnum
CREATE TYPE "LifestyleRelationshipStyle" AS ENUM ('CLOSE', 'CASUAL');

-- CreateEnum
CREATE TYPE "LifestyleTemperatureSensitivity" AS ENUM ('COLD', 'NORMAL', 'HOT');

-- CreateEnum
CREATE TYPE "RoommateSmokingTolerance" AS ENUM ('NO_ONLY', 'E_CIG_OK', 'ANY');

-- CreateEnum
CREATE TYPE "RoommatePhoneTolerance" AS ENUM ('OUTSIDE_ONLY', 'BRIEF_OK', 'ANY');

-- CreateEnum
CREATE TYPE "RoommateEarphoneExpectation" AS ENUM ('MUST', 'STUDY', 'ANY');

-- CreateEnum
CREATE TYPE "RoommateSleepEnvPreference" AS ENUM ('NO_SPEAKER', 'SPEAKER_OK');

-- CreateEnum
CREATE TYPE "RoommateScreenTolerance" AS ENUM ('NO_SCREEN', 'LOW_OK', 'SCREEN_OK');

-- CreateEnum
CREATE TYPE "RoommateIndoorEatingTolerance" AS ENUM ('NO_SMELL', 'CLEAN_OK', 'ANY');

-- CreateEnum
CREATE TYPE "RoommateCleanExpectation" AS ENUM ('STRICT', 'BASIC', 'FLEXIBLE');


-- CreateEnum
CREATE TYPE "RoommateDrinkingTolerance" AS ENUM ('LOW_ONLY', 'ANY');

-- CreateEnum
CREATE TYPE "ProfileHistorySource" AS ENUM ('SIGNUP_CREATE', 'USER_EDIT', 'SEASON_REGISTRATION', 'SEASON_USER_EDIT', 'RETENTION_SNAPSHOT', 'SYSTEM_BACKFILL');

-- CreateTable
CREATE TABLE "CampusMaster" (
    "code" "Campus" NOT NULL,
    "nameKo" TEXT NOT NULL,
    "isOperated" BOOLEAN NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampusMaster_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "CampusGuideContent" (
    "campusCode" "Campus" NOT NULL,
    "homepageUrl" TEXT NOT NULL,
    "commonRules" JSONB NOT NULL,
    "emergencyContacts" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampusGuideContent_pkey" PRIMARY KEY ("campusCode")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "Dormitory" (
    "id" TEXT NOT NULL,
    "campusCode" "Campus" NOT NULL,
    "nameKo" TEXT NOT NULL,
    "roomType" INTEGER NOT NULL,
    "genderPolicy" "DormitoryGenderPolicy" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dormitory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DormitoryGuide" (
    "dormitoryId" TEXT NOT NULL,
    "bathroomType" "DormitoryBathroomType" NOT NULL,
    "facilities" JSONB NOT NULL,
    "repairContact" TEXT NOT NULL,
    "diningContact" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DormitoryGuide_pkey" PRIMARY KEY ("dormitoryId")
);

-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL,
    "campusCode" "Campus" NOT NULL DEFAULT 'CHUNCHEON',
    "academicYear" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "preparationStartDate" DATE NOT NULL,
    "matchingStartDate" DATE NOT NULL,
    "seasonEndDate" DATE NOT NULL,
    "overrideState" "SeasonOverrideState",
    "overrideReason" TEXT,
    "overrideStartedAt" TIMESTAMPTZ(3),
    "overrideEndsAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonDormitoryOperation" (
    "seasonId" TEXT NOT NULL,
    "dormitoryId" TEXT NOT NULL,
    "isOperated" BOOLEAN NOT NULL DEFAULT true,
    "roomSelectionDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonDormitoryOperation_pkey" PRIMARY KEY ("seasonId","dormitoryId")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "campus" "Campus" NOT NULL,
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "nicknameNormalized" TEXT NOT NULL,
    "nicknameChangedAt" TIMESTAMPTZ(3),
    "bedtime" "LifestyleBedtime",
    "wakeTime" "LifestyleWakeTime",
    "sleepHabit" "LifestyleSleepHabit",
    "sleepEnvironment" "LifestyleSleepEnvironment",
    "screenUsage" "LifestyleScreenUsage",
    "noiseSensitivity" "LifestyleNoiseSensitivity",
    "smokingBehavior" "LifestyleSmokingBehavior",
    "indoorEating" "LifestyleIndoorEating",
    "phoneBehavior" "LifestylePhoneBehavior",
    "earphoneUsage" "LifestyleEarphoneUsage",
    "cleanLevel" "LifestyleCleanLevel",
    "drinkingFrequency" "LifestyleDrinkingFrequency",
    "relationshipStyle" "LifestyleRelationshipStyle",
    "temperatureSensitivity" "LifestyleTemperatureSensitivity",
    "smokingTolerance" "RoommateSmokingTolerance",
    "phoneTolerance" "RoommatePhoneTolerance",
    "earphoneExpectation" "RoommateEarphoneExpectation",
    "sleepEnvPreference" "RoommateSleepEnvPreference",
    "screenTolerance" "RoommateScreenTolerance",
    "indoorEatingTolerance" "RoommateIndoorEatingTolerance",
    "cleanExpectation" "RoommateCleanExpectation",
    "drinkingTolerance" "RoommateDrinkingTolerance",
    "intro" TEXT NOT NULL DEFAULT '',
    "messageToRoommate" TEXT,
    "collegeCode" TEXT,
    "grade" TEXT,
    "mbti" TEXT,
    "birthYear" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);


-- CreateTable
CREATE TABLE "UserProfileHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "retainedIdentityId" TEXT,
    "nickname" TEXT NOT NULL,
    "nicknameNormalized" TEXT NOT NULL,
    "nicknameChangedAt" TIMESTAMPTZ(3),
    "bedtime" "LifestyleBedtime",
    "wakeTime" "LifestyleWakeTime",
    "sleepHabit" "LifestyleSleepHabit",
    "sleepEnvironment" "LifestyleSleepEnvironment",
    "screenUsage" "LifestyleScreenUsage",
    "noiseSensitivity" "LifestyleNoiseSensitivity",
    "smokingBehavior" "LifestyleSmokingBehavior",
    "indoorEating" "LifestyleIndoorEating",
    "phoneBehavior" "LifestylePhoneBehavior",
    "earphoneUsage" "LifestyleEarphoneUsage",
    "cleanLevel" "LifestyleCleanLevel",
    "drinkingFrequency" "LifestyleDrinkingFrequency",
    "relationshipStyle" "LifestyleRelationshipStyle",
    "temperatureSensitivity" "LifestyleTemperatureSensitivity",
    "smokingTolerance" "RoommateSmokingTolerance",
    "phoneTolerance" "RoommatePhoneTolerance",
    "earphoneExpectation" "RoommateEarphoneExpectation",
    "sleepEnvPreference" "RoommateSleepEnvPreference",
    "screenTolerance" "RoommateScreenTolerance",
    "indoorEatingTolerance" "RoommateIndoorEatingTolerance",
    "cleanExpectation" "RoommateCleanExpectation",
    "drinkingTolerance" "RoommateDrinkingTolerance",
    "intro" TEXT NOT NULL,
    "messageToRoommate" TEXT,
    "collegeCode" TEXT,
    "grade" TEXT,
    "mbti" TEXT,
    "birthYear" INTEGER,
    "source" "ProfileHistorySource" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProfileHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonParticipant" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "participationIntent" "SeasonParticipationIntent" NOT NULL DEFAULT 'UNDECIDED',
    "registeredAt" TIMESTAMPTZ(3),
    "declinedAt" TIMESTAMPTZ(3),
    "dormitoryId" TEXT,
    "dormitorySelectionState" "DormitorySelectionState" NOT NULL DEFAULT 'NOT_SELECTED',
    "participantStatus" "ParticipantStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "campusCodeSnapshot" "Campus" NOT NULL,
    "genderSnapshot" "Gender" NOT NULL,
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMPTZ(3),
    "matchedAt" TIMESTAMPTZ(3),
    "withdrawnAt" TIMESTAMPTZ(3),
    "expiredAt" TIMESTAMPTZ(3),
    "hiddenByAdminAt" TIMESTAMPTZ(3),
    "hiddenReasonCode" "ParticipantHiddenReasonCode",
    "hiddenReasonDetail" TEXT,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonParticipantProfile" (
    "participantId" TEXT NOT NULL,
    "nicknameSnapshot" TEXT NOT NULL,
    "nicknameNormalizedSnapshot" TEXT NOT NULL,
    "bedtime" "LifestyleBedtime" NOT NULL,
    "wakeTime" "LifestyleWakeTime" NOT NULL,
    "sleepHabit" "LifestyleSleepHabit" NOT NULL,
    "sleepEnvironment" "LifestyleSleepEnvironment" NOT NULL,
    "screenUsage" "LifestyleScreenUsage" NOT NULL,
    "noiseSensitivity" "LifestyleNoiseSensitivity" NOT NULL,
    "smokingBehavior" "LifestyleSmokingBehavior" NOT NULL,
    "indoorEating" "LifestyleIndoorEating" NOT NULL,
    "phoneBehavior" "LifestylePhoneBehavior" NOT NULL,
    "earphoneUsage" "LifestyleEarphoneUsage" NOT NULL,
    "cleanLevel" "LifestyleCleanLevel" NOT NULL,
    "drinkingFrequency" "LifestyleDrinkingFrequency" NOT NULL,
    "relationshipStyle" "LifestyleRelationshipStyle" NOT NULL,
    "temperatureSensitivity" "LifestyleTemperatureSensitivity" NOT NULL,
    "smokingTolerance" "RoommateSmokingTolerance" NOT NULL,
    "phoneTolerance" "RoommatePhoneTolerance" NOT NULL,
    "earphoneExpectation" "RoommateEarphoneExpectation" NOT NULL,
    "sleepEnvPreference" "RoommateSleepEnvPreference" NOT NULL,
    "screenTolerance" "RoommateScreenTolerance" NOT NULL,
    "indoorEatingTolerance" "RoommateIndoorEatingTolerance" NOT NULL,
    "cleanExpectation" "RoommateCleanExpectation" NOT NULL,
    "drinkingTolerance" "RoommateDrinkingTolerance" NOT NULL,
    "intro" TEXT NOT NULL DEFAULT '',
    "messageToRoommate" TEXT,
    "collegeCode" TEXT,
    "grade" TEXT,
    "mbti" TEXT,
    "birthYear" INTEGER,
    "templateSourceUserProfileUpdatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonParticipantProfile_pkey" PRIMARY KEY ("participantId")
);


-- CreateTable
CREATE TABLE "SeasonParticipantProfileHistory" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "retainedIdentityId" TEXT,
    "nicknameSnapshot" TEXT NOT NULL,
    "nicknameNormalizedSnapshot" TEXT NOT NULL,
    "bedtime" "LifestyleBedtime" NOT NULL,
    "wakeTime" "LifestyleWakeTime" NOT NULL,
    "sleepHabit" "LifestyleSleepHabit" NOT NULL,
    "sleepEnvironment" "LifestyleSleepEnvironment" NOT NULL,
    "screenUsage" "LifestyleScreenUsage" NOT NULL,
    "noiseSensitivity" "LifestyleNoiseSensitivity" NOT NULL,
    "smokingBehavior" "LifestyleSmokingBehavior" NOT NULL,
    "indoorEating" "LifestyleIndoorEating" NOT NULL,
    "phoneBehavior" "LifestylePhoneBehavior" NOT NULL,
    "earphoneUsage" "LifestyleEarphoneUsage" NOT NULL,
    "cleanLevel" "LifestyleCleanLevel" NOT NULL,
    "drinkingFrequency" "LifestyleDrinkingFrequency" NOT NULL,
    "relationshipStyle" "LifestyleRelationshipStyle" NOT NULL,
    "temperatureSensitivity" "LifestyleTemperatureSensitivity" NOT NULL,
    "smokingTolerance" "RoommateSmokingTolerance" NOT NULL,
    "phoneTolerance" "RoommatePhoneTolerance" NOT NULL,
    "earphoneExpectation" "RoommateEarphoneExpectation" NOT NULL,
    "sleepEnvPreference" "RoommateSleepEnvPreference" NOT NULL,
    "screenTolerance" "RoommateScreenTolerance" NOT NULL,
    "indoorEatingTolerance" "RoommateIndoorEatingTolerance" NOT NULL,
    "cleanExpectation" "RoommateCleanExpectation" NOT NULL,
    "drinkingTolerance" "RoommateDrinkingTolerance" NOT NULL,
    "intro" TEXT NOT NULL,
    "messageToRoommate" TEXT,
    "collegeCode" TEXT,
    "grade" TEXT,
    "mbti" TEXT,
    "birthYear" INTEGER,
    "templateSourceUserProfileUpdatedAt" TIMESTAMPTZ(3),
    "source" "ProfileHistorySource" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonParticipantProfileHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRequest" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "pairMinParticipantId" TEXT NOT NULL,
    "pairMaxParticipantId" TEXT NOT NULL,
    "requesterParticipantId" TEXT NOT NULL,
    "receiverParticipantId" TEXT NOT NULL,
    "note" TEXT,
    "status" "MatchRequestStatus" NOT NULL DEFAULT 'PENDING',
    "terminalReason" "MatchRequestTerminalReason",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "terminalAt" TIMESTAMPTZ(3),
    "acceptedAt" TIMESTAMPTZ(3),
    "requestChannel" "MatchRequestChannel",

    CONSTRAINT "MatchRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveMatch" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "participantAId" TEXT NOT NULL,
    "participantBId" TEXT NOT NULL,
    "createdFromRequestId" TEXT NOT NULL,
    "status" "ActiveMatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMPTZ(3),
    "endReason" "ActiveMatchEndReason",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActiveMatchUnmatchRequest" (
    "id" TEXT NOT NULL,
    "activeMatchId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "status" "ActiveMatchUnmatchRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminalAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActiveMatchUnmatchRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonMatchHistoryEntry" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "viewerParticipantId" TEXT NOT NULL,
    "counterpartParticipantId" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "entryType" "SeasonMatchHistoryEntryType" NOT NULL,
    "entryResult" "SeasonMatchHistoryEntryResult" NOT NULL,
    "viewerRequested" BOOLEAN NOT NULL,
    "sourceRequestId" TEXT,
    "sourceActiveMatchId" TEXT,
    "createdFromRequestId" TEXT,
    "matchScore" INTEGER,
    "viewerSmokingToleranceSnapshot" "RoommateSmokingTolerance",
    "viewerPhoneToleranceSnapshot" "RoommatePhoneTolerance",
    "viewerEarphoneExpectationSnapshot" "RoommateEarphoneExpectation",
    "viewerSleepEnvPreferenceSnapshot" "RoommateSleepEnvPreference",
    "viewerScreenToleranceSnapshot" "RoommateScreenTolerance",
    "viewerIndoorEatingToleranceSnapshot" "RoommateIndoorEatingTolerance",
    "viewerCleanExpectationSnapshot" "RoommateCleanExpectation",
    "viewerDrinkingToleranceSnapshot" "RoommateDrinkingTolerance",
    "viewerBedtimeSnapshot" "LifestyleBedtime",
    "viewerWakeTimeSnapshot" "LifestyleWakeTime",
    "viewerRelationshipStyleSnapshot" "LifestyleRelationshipStyle",
    "viewerTemperatureSensitivitySnapshot" "LifestyleTemperatureSensitivity",
    "counterpartBedtimeSnapshot" "LifestyleBedtime",
    "counterpartWakeTimeSnapshot" "LifestyleWakeTime",
    "counterpartSleepHabitSnapshot" "LifestyleSleepHabit",
    "counterpartSleepEnvironmentSnapshot" "LifestyleSleepEnvironment",
    "counterpartScreenUsageSnapshot" "LifestyleScreenUsage",
    "counterpartNoiseSensitivitySnapshot" "LifestyleNoiseSensitivity",
    "counterpartSmokingBehaviorSnapshot" "LifestyleSmokingBehavior",
    "counterpartIndoorEatingSnapshot" "LifestyleIndoorEating",
    "counterpartPhoneBehaviorSnapshot" "LifestylePhoneBehavior",
    "counterpartEarphoneUsageSnapshot" "LifestyleEarphoneUsage",
    "counterpartCleanLevelSnapshot" "LifestyleCleanLevel",
    "counterpartDrinkingFrequencySnapshot" "LifestyleDrinkingFrequency",
    "counterpartRelationshipStyleSnapshot" "LifestyleRelationshipStyle",
    "counterpartTemperatureSensitivitySnapshot" "LifestyleTemperatureSensitivity",
    "counterpartNicknameSnapshot" TEXT NOT NULL,
    "viewerDormitoryIdSnapshot" TEXT,
    "hadConversation" BOOLEAN NOT NULL DEFAULT false,
    "matchedAt" TIMESTAMPTZ(3),
    "unmatchedAt" TIMESTAMPTZ(3),
    "finalizedAt" TIMESTAMPTZ(3) NOT NULL,
    "requestTerminalReason" "MatchRequestTerminalReason",
    "activeMatchEndReason" "ActiveMatchEndReason",
    "threadClosedReason" "ConversationThreadClosedReason",
    "threadClosedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonMatchHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

    CONSTRAINT "ConversationThreadMember_pkey" PRIMARY KEY ("threadId","participantId")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "lastFailedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "purpose" "VerificationCodePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3),
    "consumedAt" TIMESTAMPTZ(3),
    "requestIp" TEXT,

    CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationCodeRequestLog" (
    "id" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "purpose" "VerificationCodePurpose" NOT NULL,
    "requestIp" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationCodeRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "refreshTokenHash" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationTerm" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "normalizedTerm" TEXT NOT NULL,
    "category" "ModerationTermCategory" NOT NULL,
    "matchMode" "ModerationMatchMode" NOT NULL,
    "surface" "ModerationSurface" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollegeMaster_campusCode_sortOrder_idx" ON "CollegeMaster"("campusCode", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CollegeMaster_campusCode_nameKo_key" ON "CollegeMaster"("campusCode", "nameKo");

-- CreateIndex
CREATE INDEX "Dormitory_campusCode_genderPolicy_sortOrder_idx" ON "Dormitory"("campusCode", "genderPolicy", "sortOrder");

-- CreateIndex
CREATE INDEX "Season_campusCode_matchingStartDate_idx" ON "Season"("campusCode", "matchingStartDate");

-- CreateIndex
CREATE INDEX "Season_campusCode_seasonEndDate_idx" ON "Season"("campusCode", "seasonEndDate");

-- CreateIndex
CREATE UNIQUE INDEX "Season_campusCode_academicYear_semester_key" ON "Season"("campusCode", "academicYear", "semester");

-- CreateIndex
CREATE INDEX "SeasonDormitoryOperation_seasonId_isOperated_roomSelectionD_idx" ON "SeasonDormitoryOperation"("seasonId", "isOperated", "roomSelectionDate");

-- CreateIndex
CREATE INDEX "SeasonDormitoryOperation_dormitoryId_roomSelectionDate_idx" ON "SeasonDormitoryOperation"("dormitoryId", "roomSelectionDate");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_nicknameNormalized_key" ON "UserProfile"("nicknameNormalized");

-- CreateIndex
CREATE INDEX "UserProfile_nickname_idx" ON "UserProfile"("nickname");

-- CreateIndex
CREATE INDEX "UserProfile_collegeCode_idx" ON "UserProfile"("collegeCode");


-- CreateIndex
CREATE INDEX "UserProfileHistory_userId_createdAt_idx" ON "UserProfileHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserProfileHistory_retainedIdentityId_createdAt_idx" ON "UserProfileHistory"("retainedIdentityId", "createdAt");

-- CreateIndex
CREATE INDEX "SeasonParticipantProfileHistory_participantId_createdAt_idx" ON "SeasonParticipantProfileHistory"("participantId", "createdAt");

-- CreateIndex
CREATE INDEX "SeasonParticipantProfileHistory_seasonId_participantId_crea_idx" ON "SeasonParticipantProfileHistory"("seasonId", "participantId", "createdAt");

-- CreateIndex
CREATE INDEX "SeasonParticipantProfileHistory_retainedIdentityId_createdA_idx" ON "SeasonParticipantProfileHistory"("retainedIdentityId", "createdAt");

-- CreateIndex
CREATE INDEX "SeasonParticipant_userId_seasonId_idx" ON "SeasonParticipant"("userId", "seasonId");

-- CreateIndex
CREATE INDEX "SeasonParticipant_seasonId_dormitoryId_dormitorySelectionSt_idx" ON "SeasonParticipant"("seasonId", "dormitoryId", "dormitorySelectionState");

-- CreateIndex
CREATE INDEX "SeasonParticipant_seasonId_participantStatus_idx" ON "SeasonParticipant"("seasonId", "participantStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonParticipant_seasonId_userId_key" ON "SeasonParticipant"("seasonId", "userId");

-- CreateIndex
CREATE INDEX "SeasonParticipantProfile_collegeCode_idx" ON "SeasonParticipantProfile"("collegeCode");

-- CreateIndex
CREATE INDEX "SeasonParticipantProfile_nicknameNormalizedSnapshot_idx" ON "SeasonParticipantProfile"("nicknameNormalizedSnapshot");

-- CreateIndex
CREATE INDEX "MatchRequest_seasonId_requesterParticipantId_receiverPartic_idx" ON "MatchRequest"("seasonId", "requesterParticipantId", "receiverParticipantId", "createdAt");

-- CreateIndex
CREATE INDEX "MatchRequest_seasonId_receiverParticipantId_status_idx" ON "MatchRequest"("seasonId", "receiverParticipantId", "status");

-- CreateIndex
CREATE INDEX "MatchRequest_expiresAt_status_idx" ON "MatchRequest"("expiresAt", "status");

-- CreateIndex
CREATE INDEX "MatchRequest_seasonId_pairKey_status_idx" ON "MatchRequest"("seasonId", "pairKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ActiveMatch_createdFromRequestId_key" ON "ActiveMatch"("createdFromRequestId");

-- CreateIndex
CREATE INDEX "ActiveMatch_seasonId_pairKey_endedAt_idx" ON "ActiveMatch"("seasonId", "pairKey", "endedAt");

-- CreateIndex
CREATE INDEX "ActiveMatch_participantAId_endedAt_idx" ON "ActiveMatch"("participantAId", "endedAt");

-- CreateIndex
CREATE INDEX "ActiveMatch_participantBId_endedAt_idx" ON "ActiveMatch"("participantBId", "endedAt");

-- CreateIndex
CREATE INDEX "ActiveMatch_seasonId_status_endedAt_idx" ON "ActiveMatch"("seasonId", "status", "endedAt");

-- CreateIndex
CREATE INDEX "ActiveMatchUnmatchRequest_activeMatchId_status_requestedAt_idx" ON "ActiveMatchUnmatchRequest"("activeMatchId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "ActiveMatchUnmatchRequest_participantId_status_requestedAt_idx" ON "ActiveMatchUnmatchRequest"("participantId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "SeasonMatchHistoryEntry_seasonId_viewerParticipantId_finali_idx" ON "SeasonMatchHistoryEntry"("seasonId", "viewerParticipantId", "finalizedAt");

-- CreateIndex
CREATE INDEX "SeasonMatchHistoryEntry_viewerParticipantId_counterpartPart_idx" ON "SeasonMatchHistoryEntry"("viewerParticipantId", "counterpartParticipantId", "finalizedAt");

-- CreateIndex
CREATE INDEX "SeasonMatchHistoryEntry_seasonId_pairKey_finalizedAt_idx" ON "SeasonMatchHistoryEntry"("seasonId", "pairKey", "finalizedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationThread_activeMatchId_key" ON "ConversationThread"("activeMatchId");

-- CreateIndex
CREATE INDEX "ConversationThread_seasonId_pairKey_status_idx" ON "ConversationThread"("seasonId", "pairKey", "status");

-- CreateIndex
CREATE INDEX "ConversationThread_participantAId_idx" ON "ConversationThread"("participantAId");

-- CreateIndex
CREATE INDEX "ConversationThread_participantBId_idx" ON "ConversationThread"("participantBId");

-- CreateIndex
CREATE INDEX "ConversationMessage_threadId_sentAt_idx" ON "ConversationMessage"("threadId", "sentAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_senderParticipantId_sentAt_idx" ON "ConversationMessage"("senderParticipantId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoginAttempt_emailNormalized_key" ON "LoginAttempt"("emailNormalized");

-- CreateIndex
CREATE INDEX "VerificationCode_emailNormalized_purpose_idx" ON "VerificationCode"("emailNormalized", "purpose");

-- CreateIndex
CREATE INDEX "VerificationCodeRequestLog_emailNormalized_purpose_requestI_idx" ON "VerificationCodeRequestLog"("emailNormalized", "purpose", "requestIp", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationCodeRequestLog_requestIp_createdAt_idx" ON "VerificationCodeRequestLog"("requestIp", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "ModerationTerm_surface_category_isActive_idx" ON "ModerationTerm"("surface", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationTerm_normalizedTerm_category_matchMode_surface_key" ON "ModerationTerm"("normalizedTerm", "category", "matchMode", "surface");

-- Custom constraints not expressible in Prisma schema
ALTER TABLE "UserProfile"
  ADD CONSTRAINT "UserProfile_grade_check"
  CHECK ("grade" IS NULL OR "grade" IN ('1', '2', '3', '4+'));

ALTER TABLE "SeasonParticipantProfile"
  ADD CONSTRAINT "SeasonParticipantProfile_grade_check"
  CHECK ("grade" IS NULL OR "grade" IN ('1', '2', '3', '4+'));


ALTER TABLE "UserProfileHistory"
  ADD CONSTRAINT "UserProfileHistory_grade_check"
  CHECK ("grade" IS NULL OR "grade" IN ('1', '2', '3', '4+'));

ALTER TABLE "SeasonParticipantProfileHistory"
  ADD CONSTRAINT "SeasonParticipantProfileHistory_grade_check"
  CHECK ("grade" IS NULL OR "grade" IN ('1', '2', '3', '4+'));

ALTER TABLE "UserProfile"
  ADD CONSTRAINT "UserProfile_birthYear_check"
  CHECK ("birthYear" IS NULL OR "birthYear" >= 1980);

ALTER TABLE "SeasonParticipantProfile"
  ADD CONSTRAINT "SeasonParticipantProfile_birthYear_check"
  CHECK ("birthYear" IS NULL OR "birthYear" >= 1980);


ALTER TABLE "UserProfileHistory"
  ADD CONSTRAINT "UserProfileHistory_birthYear_check"
  CHECK ("birthYear" IS NULL OR "birthYear" >= 1980);

ALTER TABLE "SeasonParticipantProfileHistory"
  ADD CONSTRAINT "SeasonParticipantProfileHistory_birthYear_check"
  CHECK ("birthYear" IS NULL OR "birthYear" >= 1980);

-- Partial unique indexes for live/current invariants
CREATE UNIQUE INDEX "MatchRequest_seasonId_pairMinParticipantId_pairMaxParticipantId_pending_key"
ON "MatchRequest"("seasonId", "pairMinParticipantId", "pairMaxParticipantId")
WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "ActiveMatch_seasonId_pairKey_live_key"
ON "ActiveMatch"("seasonId", "pairKey")
WHERE "endedAt" IS NULL;

CREATE UNIQUE INDEX "ConversationThread_seasonId_pairKey_live_key"
ON "ConversationThread"("seasonId", "pairKey")
WHERE "status" <> 'ARCHIVED';

CREATE UNIQUE INDEX "ActiveMatchUnmatchRequest_activeMatchId_participantId_pending_key"
ON "ActiveMatchUnmatchRequest"("activeMatchId", "participantId")
WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "CampusGuideContent" ADD CONSTRAINT "CampusGuideContent_campusCode_fkey" FOREIGN KEY ("campusCode") REFERENCES "CampusMaster"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollegeMaster" ADD CONSTRAINT "CollegeMaster_campusCode_fkey" FOREIGN KEY ("campusCode") REFERENCES "CampusMaster"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dormitory" ADD CONSTRAINT "Dormitory_campusCode_fkey" FOREIGN KEY ("campusCode") REFERENCES "CampusMaster"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DormitoryGuide" ADD CONSTRAINT "DormitoryGuide_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES "Dormitory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Season" ADD CONSTRAINT "Season_campusCode_fkey" FOREIGN KEY ("campusCode") REFERENCES "CampusMaster"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDormitoryOperation" ADD CONSTRAINT "SeasonDormitoryOperation_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDormitoryOperation" ADD CONSTRAINT "SeasonDormitoryOperation_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES "Dormitory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_collegeCode_fkey" FOREIGN KEY ("collegeCode") REFERENCES "CollegeMaster"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipant" ADD CONSTRAINT "SeasonParticipant_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES "Dormitory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipant" ADD CONSTRAINT "SeasonParticipant_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipant" ADD CONSTRAINT "SeasonParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipantProfile" ADD CONSTRAINT "SeasonParticipantProfile_collegeCode_fkey" FOREIGN KEY ("collegeCode") REFERENCES "CollegeMaster"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipantProfile" ADD CONSTRAINT "SeasonParticipantProfile_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRequest" ADD CONSTRAINT "MatchRequest_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRequest" ADD CONSTRAINT "MatchRequest_requesterParticipantId_fkey" FOREIGN KEY ("requesterParticipantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRequest" ADD CONSTRAINT "MatchRequest_receiverParticipantId_fkey" FOREIGN KEY ("receiverParticipantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveMatch" ADD CONSTRAINT "ActiveMatch_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveMatch" ADD CONSTRAINT "ActiveMatch_participantAId_fkey" FOREIGN KEY ("participantAId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveMatch" ADD CONSTRAINT "ActiveMatch_participantBId_fkey" FOREIGN KEY ("participantBId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveMatch" ADD CONSTRAINT "ActiveMatch_createdFromRequestId_fkey" FOREIGN KEY ("createdFromRequestId") REFERENCES "MatchRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveMatchUnmatchRequest" ADD CONSTRAINT "ActiveMatchUnmatchRequest_activeMatchId_fkey" FOREIGN KEY ("activeMatchId") REFERENCES "ActiveMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveMatchUnmatchRequest" ADD CONSTRAINT "ActiveMatchUnmatchRequest_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMatchHistoryEntry" ADD CONSTRAINT "SeasonMatchHistoryEntry_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMatchHistoryEntry" ADD CONSTRAINT "SeasonMatchHistoryEntry_viewerParticipantId_fkey" FOREIGN KEY ("viewerParticipantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMatchHistoryEntry" ADD CONSTRAINT "SeasonMatchHistoryEntry_counterpartParticipantId_fkey" FOREIGN KEY ("counterpartParticipantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_participantAId_fkey" FOREIGN KEY ("participantAId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_participantBId_fkey" FOREIGN KEY ("participantBId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_openedByParticipantId_fkey" FOREIGN KEY ("openedByParticipantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_activeMatchId_fkey" FOREIGN KEY ("activeMatchId") REFERENCES "ActiveMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationThreadMember" ADD CONSTRAINT "ConversationThreadMember_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ConversationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationThreadMember" ADD CONSTRAINT "ConversationThreadMember_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ConversationThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_senderParticipantId_fkey" FOREIGN KEY ("senderParticipantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

