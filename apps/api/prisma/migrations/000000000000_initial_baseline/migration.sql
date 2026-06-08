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
CREATE TYPE "AuthSecurityEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGIN_LOCKOUT', 'VERIFICATION_CODE_REQUESTED', 'VERIFICATION_CODE_VERIFY_SUCCESS', 'VERIFICATION_CODE_VERIFY_FAILURE', 'RESET_PASSWORD_CONSUMED', 'CHANGE_PASSWORD_SUCCESS', 'SESSION_REFRESH_SUCCESS', 'SESSION_REVOKED', 'SESSION_REVOKE_ALL', 'SESSION_TOKEN_REUSE_DETECTED', 'OPAQUE_TRANSPORT_REJECTED', 'MAIL_SEND_SUCCESS', 'MAIL_SEND_FAILURE');

-- CreateEnum
CREATE TYPE "AuthSecurityEventSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ModerationTermCategory" AS ENUM ('BLOCKED_TEXT', 'RESERVED_NICKNAME');

-- CreateEnum
CREATE TYPE "ModerationMatchMode" AS ENUM ('EXACT', 'INCLUDES');

-- CreateEnum
CREATE TYPE "ModerationSurface" AS ENUM ('ALL', 'NICKNAME', 'INTRO');

-- CreateEnum
CREATE TYPE "DormitorySelectionState" AS ENUM ('NOT_SELECTED', 'SELECTED', 'UNASSIGNED', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "DormitoryGenderPolicy" AS ENUM ('M', 'F', 'BOTH');

-- CreateEnum
CREATE TYPE "DormitoryBathroomType" AS ENUM ('SHARED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "SeasonOverrideState" AS ENUM ('OFF_SEASON', 'SEASON_OPEN', 'SEASON_MATCHING', 'SEASON_POST_MATCH');

-- CreateEnum
CREATE TYPE "SeasonOperationAuditAction" AS ENUM ('UPDATE_SCHEDULE', 'UPDATE_OVERRIDE', 'CLEAR_OVERRIDE');

-- CreateEnum
CREATE TYPE "SeasonParticipationIntent" AS ENUM ('UNDECIDED', 'REGISTERED', 'DECLINED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'ACTIVE', 'MATCHED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ParticipantHiddenReasonCode" AS ENUM ('POLICY_VIOLATION', 'SAFETY_REVIEW', 'ADMIN_REQUEST', 'OTHER');

-- CreateEnum
CREATE TYPE "SeasonParticipantLifecycleEventType" AS ENUM ('JOINED', 'ACTIVATED', 'WITHDRAWN', 'EXPIRED', 'DEACTIVATED', 'HIDDEN', 'UNHIDDEN', 'MATCHED', 'UNMATCHED');

-- CreateEnum
CREATE TYPE "UserBlockEventType" AS ENUM ('BLOCKED', 'UNBLOCKED');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('PROFILE', 'MATCH_REQUEST', 'CHAT_THREAD', 'CHAT_MESSAGE', 'SUPPORT_TICKET');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SEXUAL_HARASSMENT', 'THREAT', 'PERSONAL_INFO_EXPOSURE', 'GENDER_IMPERSONATION', 'FALSE_PROFILE', 'SPAM_OR_AD', 'HATE_OR_DISCRIMINATION', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportRiskTier" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('SUBMITTED', 'EVIDENCE_ONLY');

-- CreateEnum
CREATE TYPE "ReportOptionalAction" AS ENUM ('BLOCK_TARGET');

-- CreateEnum
CREATE TYPE "ReportCaseEventType" AS ENUM ('REPORT_SUBMITTED', 'REPORT_REPLAYED', 'REPORT_RECEIPT_NOTIFICATION_QUEUED', 'OPTIONAL_BLOCK_RESULT_RECORDED', 'RETENTION_REFERENCE_RECORDED', 'HIGH_RISK_ALERT_CANDIDATE_RECORDED', 'PROFILE_MISMATCH_FEEDBACK_CANDIDATE_RECORDED', 'UNVERIFIED_ATTACHMENT_POINTERS_RECORDED');

-- CreateEnum
CREATE TYPE "ReportActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MatchRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED_BY_REQUESTER', 'CANCELLED_BY_SYSTEM', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MatchRequestTerminalReason" AS ENUM ('ACCEPTED', 'REJECTED_BY_RECEIVER', 'CANCELLED_BY_REQUESTER', 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH', 'EXPIRED', 'WITHDRAWN_PARTICIPANT', 'MATCH_PRECONDITION_FAILED', 'ADMIN_ACTION');

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
CREATE TYPE "ConversationThreadClosedReason" AS ENUM ('ACTIVE_MATCH_CREATED', 'ROOM_SELECTION_CUTOFF', 'SEASON_ENDED', 'PARTICIPANT_WITHDRAWN', 'USER_BLOCKED', 'MODERATION', 'ADMIN_ACTION');

-- CreateEnum
CREATE TYPE "ConversationThreadMemberState" AS ENUM ('ACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "ConversationMessageBodyState" AS ENUM ('PLAIN', 'TOMBSTONED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "ConversationMessageTombstoneReason" AS ENUM ('ACCOUNT_DELETION_RETENTION', 'USER_MESSAGE_DELETED', 'MODERATION_POLICY_VIOLATION', 'ADMIN_ACTION', 'RETENTION_DISPOSED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('CHAT_THREAD_CREATED', 'REPORT_RECEIVED', 'REPORT_STATUS_UPDATED', 'PROFILE_MISMATCH_FEEDBACK', 'SEASON_SYSTEM_NOTICE', 'SUPPORT_TICKET_CREATED', 'SUPPORT_TICKET_REPLIED', 'SUPPORT_TICKET_ACTION_REQUIRED', 'SUPPORT_APPEAL_RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationOutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationCampaignStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "OperatorAlertStatus" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "OperatorAlertCategory" AS ENUM ('HIGH_RISK_REPORT');

-- CreateEnum
CREATE TYPE "OperatorAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RetainedVaultObjectTarget" AS ENUM ('CHAT_MESSAGE_BODY', 'SEASON_PROFILE_HISTORY', 'MATCH_HISTORY_ENTRY', 'NICKNAME_AUDIT_EVENT', 'ACADEMIC_IDENTITY_AUDIT_EVENT');

-- CreateEnum
CREATE TYPE "RetainedVaultObjectState" AS ENUM ('RETAINED', 'DISPOSED', 'FAILED_MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "RetentionCaseReason" AS ENUM ('ACCOUNT_DELETION', 'REPORT_REVIEW', 'ENFORCEMENT_RECORD', 'DISPUTE_RESPONSE', 'LEGAL_HOLD', 'ADMIN_MANUAL', 'CHAT_THREAD_ARCHIVE');

-- CreateEnum
CREATE TYPE "RetainedVaultSubjectRole" AS ENUM ('USER', 'PARTICIPANT', 'VIEWER', 'COUNTERPART', 'MESSAGE_SENDER');

-- CreateEnum
CREATE TYPE "RetentionAccessTargetType" AS ENUM ('IDENTITY_ANCHOR', 'VAULT_OBJECT');

-- CreateEnum
CREATE TYPE "RetentionAccessReason" AS ENUM ('LAW_ENFORCEMENT_REQUEST', 'REPORT_REVIEW', 'DISPUTE_RESPONSE', 'ENFORCEMENT_REVIEW', 'SECURITY_AUDIT', 'RETENTION_EXPIRY_REVIEW');

-- CreateEnum
CREATE TYPE "RetentionAccessResult" AS ENUM ('DISCLOSED', 'DENIED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "RetentionReviewJobTarget" AS ENUM ('CHAT_IDENTITY_LINK', 'ACCESS_LOG_DISPOSAL');

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
CREATE TYPE "ProfileHistorySource" AS ENUM ('SEASON_REGISTRATION', 'SYSTEM_BACKFILL');

-- CreateEnum
CREATE TYPE "ArchiveJobTarget" AS ENUM ('SEASON_PROFILE_HISTORY', 'MATCH_HISTORY', 'THREAD_RETENTION', 'NICKNAME_AUDIT', 'ACADEMIC_IDENTITY_AUDIT');

-- CreateEnum
CREATE TYPE "ArchiveJobStatus" AS ENUM ('PENDING', 'WAITING_CONDITION', 'SUCCEEDED', 'RETRY_SCHEDULED', 'FAILED_MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "LegalHoldReason" AS ENUM ('LAW_ENFORCEMENT_REQUEST', 'INTERNAL_DISPUTE_REVIEW', 'SAFETY_INCIDENT', 'ADMIN_LEGAL_REVIEW');

-- CreateEnum
CREATE TYPE "DisplayIdentityNicknameChangeSource" AS ENUM ('USER_SELF', 'POLICY_ENFORCEMENT', 'ACCOUNT_DELETION_DEIDENTIFICATION');

-- CreateEnum
CREATE TYPE "DisplayIdentityNicknameChangeActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DisplayIdentityNicknameChangeReason" AS ENUM ('USER_REQUEST', 'REPORT_REVIEW', 'ENFORCEMENT_ACTION', 'SAFETY_INCIDENT', 'RESERVED_OR_BLOCKED_TERM', 'ADMIN_MANUAL', 'ACCOUNT_DELETION');

-- CreateEnum
CREATE TYPE "AcademicIdentityChangeSource" AS ENUM ('USER_SELF', 'SUPPORT_OVERRIDE', 'POLICY_ENFORCEMENT');

-- CreateEnum
CREATE TYPE "AcademicIdentityChangeActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AcademicIdentityChangeReason" AS ENUM ('USER_CORRECTION', 'ACADEMIC_CYCLE_ALLOWANCE', 'SUPPORT_OVERRIDE', 'POLICY_ENFORCEMENT');

-- CreateEnum
CREATE TYPE "AcademicIdentityAllowanceResetReason" AS ENUM ('INITIAL_CYCLE_ALLOWANCE', 'ACADEMIC_CYCLE_ROLLOVER', 'SUPPORT_OVERRIDE');

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
CREATE TABLE "SeasonOperationAuditEvent" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "campusCode" "Campus" NOT NULL,
    "action" "SeasonOperationAuditAction" NOT NULL,
    "actorUserId" TEXT,
    "actorCapabilities" JSONB,
    "reason" TEXT,
    "previousSnapshot" JSONB NOT NULL,
    "nextSnapshot" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonOperationAuditEvent_pkey" PRIMARY KEY ("id")
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
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDisplayIdentity" (
    "userId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "nicknameNormalized" TEXT NOT NULL,
    "nicknameChangedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDisplayIdentity_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserAcademicIdentity" (
    "userId" TEXT NOT NULL,
    "collegeCode" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAcademicIdentity_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserAcademicIdentityChangeAllowance" (
    "userId" TEXT NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "collegeChangeRemaining" INTEGER NOT NULL DEFAULT 1,
    "resetReason" "AcademicIdentityAllowanceResetReason" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAcademicIdentityChangeAllowance_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserDismissedNotice" (
    "userId" TEXT NOT NULL,
    "noticeKey" TEXT NOT NULL,
    "dismissedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDismissedNotice_pkey" PRIMARY KEY ("userId","noticeKey")
);

-- CreateTable
CREATE TABLE "RetainedIdentity" (
    "id" TEXT NOT NULL,
    "originalUserId" TEXT,
    "anonymizedActorKey" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "deletedAt" TIMESTAMPTZ(3) NOT NULL,
    "emailHash" TEXT,
    "encryptedIdentifierPayload" JSONB,
    "identifierKeyVersion" TEXT,
    "retentionDisposedAt" TIMESTAMPTZ(3),
    "retentionDisposalReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetainedIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDisplayIdentityNicknameChangeEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "retainedIdentityId" TEXT,
    "retainedVaultObjectId" TEXT,
    "redactedAt" TIMESTAMPTZ(3),
    "redactionReason" TEXT,
    "source" "DisplayIdentityNicknameChangeSource" NOT NULL,
    "reason" "DisplayIdentityNicknameChangeReason" NOT NULL,
    "actorType" "DisplayIdentityNicknameChangeActorType" NOT NULL,
    "actorId" TEXT,
    "previousNickname" TEXT NOT NULL,
    "previousNicknameNormalized" TEXT NOT NULL,
    "nextNickname" TEXT NOT NULL,
    "nextNicknameNormalized" TEXT NOT NULL,
    "seasonId" TEXT,
    "participantId" TEXT,
    "seasonProfileSnapshotUpdated" BOOLEAN NOT NULL DEFAULT false,
    "reportId" TEXT,
    "moderationCaseId" TEXT,
    "sanctionId" TEXT,
    "approvalReference" TEXT,
    "metadata" JSONB,
    "changedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDisplayIdentityNicknameChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAcademicIdentityChangeEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "retainedIdentityId" TEXT,
    "retainedVaultObjectId" TEXT,
    "redactedAt" TIMESTAMPTZ(3),
    "redactionReason" TEXT,
    "source" "AcademicIdentityChangeSource" NOT NULL,
    "reason" "AcademicIdentityChangeReason" NOT NULL,
    "actorType" "AcademicIdentityChangeActorType" NOT NULL,
    "actorId" TEXT,
    "previousCollegeCode" TEXT NOT NULL,
    "nextCollegeCode" TEXT NOT NULL,
    "previousBirthYear" INTEGER NOT NULL,
    "nextBirthYear" INTEGER NOT NULL,
    "seasonId" TEXT,
    "participantId" TEXT,
    "reportId" TEXT,
    "moderationCaseId" TEXT,
    "sanctionId" TEXT,
    "approvalReference" TEXT,
    "metadata" JSONB,
    "changedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAcademicIdentityChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArchiveJob" (
    "id" TEXT NOT NULL,
    "target" "ArchiveJobTarget" NOT NULL,
    "status" "ArchiveJobStatus" NOT NULL DEFAULT 'PENDING',
    "retainedIdentityId" TEXT,
    "userId" TEXT,
    "seasonId" TEXT,
    "participantId" TEXT,
    "matchHistoryEntryId" TEXT,
    "threadId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRunAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMPTZ(3),
    "lastSucceededAt" TIMESTAMPTZ(3),
    "lastErrorCode" TEXT,
    "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveJob_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "UserBookmark" (
    "id" TEXT NOT NULL,
    "viewerUserId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetParticipantId" TEXT NOT NULL,
    "bookmarkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),
    "expiredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL,
    "blockerUserId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "note" TEXT,
    "blockedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unblockedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlockEvent" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "eventType" "UserBlockEventType" NOT NULL,
    "noteSnapshot" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCase" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetParticipantId" TEXT,
    "targetThreadId" TEXT,
    "targetMessageId" TEXT,
    "targetMatchRequestId" TEXT,
    "seasonId" TEXT,
    "reason" "ReportReason" NOT NULL,
    "riskTier" "ReportRiskTier" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "detail" TEXT,
    "evidenceAttachmentIds" JSONB,
    "evidenceAttachmentPolicy" TEXT,
    "optionalBlockRequested" BOOLEAN NOT NULL DEFAULT false,
    "optionalBlockResult" JSONB,
    "falseReportDisclaimerAcceptedAt" TIMESTAMPTZ(3) NOT NULL,
    "targetSnapshot" JSONB NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportCaseEvent" (
    "id" TEXT NOT NULL,
    "reportCaseId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorType" "ReportActorType" NOT NULL DEFAULT 'USER',
    "eventType" "ReportCaseEventType" NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonParticipantLifecycleEvent" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "SeasonParticipantLifecycleEventType" NOT NULL,
    "actorUserId" TEXT,
    "actorType" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonParticipantLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonParticipantProfile" (
    "participantId" TEXT NOT NULL,
    "nicknameSnapshot" TEXT NOT NULL,
    "nicknameNormalizedSnapshot" TEXT NOT NULL,
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
    "collegeCode" TEXT,
    "grade" TEXT,
    "mbti" TEXT,
    "birthYear" INTEGER,
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
    "retainedVaultObjectId" TEXT,
    "redactedAt" TIMESTAMPTZ(3),
    "redactionReason" TEXT,
    "nicknameSnapshot" TEXT NOT NULL,
    "nicknameNormalizedSnapshot" TEXT NOT NULL,
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
    "collegeCode" TEXT,
    "grade" TEXT,
    "mbti" TEXT,
    "birthYear" INTEGER,
    "registeredAtSnapshot" TIMESTAMPTZ(3),
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
    "counterpartRedactedAt" TIMESTAMPTZ(3),
    "viewerRedactedAt" TIMESTAMPTZ(3),
    "viewerDormitoryIdSnapshot" TEXT,
    "matchedAt" TIMESTAMPTZ(3),
    "unmatchedAt" TIMESTAMPTZ(3),
    "finalizedAt" TIMESTAMPTZ(3) NOT NULL,
    "requestTerminalReason" "MatchRequestTerminalReason",
    "activeMatchEndReason" "ActiveMatchEndReason",
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
    "lastReadMessageId" TEXT,
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
    "clientMessageId" TEXT,
    "body" TEXT NOT NULL,
    "bodyState" "ConversationMessageBodyState" NOT NULL DEFAULT 'PLAIN',
    "tombstoneReason" "ConversationMessageTombstoneReason",
    "tombstonedAt" TIMESTAMPTZ(3),
    "bodyRetainedAt" TIMESTAMPTZ(3),
    "bodyDisposedAt" TIMESTAMPTZ(3),
    "retainedVaultObjectId" TEXT,
    "bodyVersion" INTEGER NOT NULL DEFAULT 1,
    "sentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRealtimeOutboxEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "threadId" TEXT,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "aggregateVersion" INTEGER,
    "payload" JSONB NOT NULL,
    "roomKeys" TEXT[] NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(3),
    "publishAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastPublishError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRealtimeOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatRealtimeEventRecipient" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT,
    "cursor" TEXT NOT NULL,
    "deliveredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRealtimeEventRecipient_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationCampaign" (
    "id" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "targetSeasonId" TEXT,
    "status" "NotificationCampaignStatus" NOT NULL DEFAULT 'PENDING',
    "cursorUserId" TEXT,
    "chunkSize" INTEGER NOT NULL DEFAULT 100,
    "enqueuedCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorAlert" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "category" "OperatorAlertCategory" NOT NULL,
    "riskTier" "ReportRiskTier",
    "severity" "OperatorAlertSeverity" NOT NULL,
    "status" "OperatorAlertStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
    "deliveredAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutboxEvent" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "status" "NotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMPTZ(3),
    "lockedBy" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "failedAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonMatchHistoryEntryRetentionLink" (
    "id" TEXT NOT NULL,
    "matchHistoryEntryId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "retainedIdentityId" TEXT NOT NULL,
    "subjectRole" "RetainedVaultSubjectRole" NOT NULL,
    "retainedVaultObjectId" TEXT,
    "redactedAt" TIMESTAMPTZ(3),
    "redactionReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonMatchHistoryEntryRetentionLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionCase" (
    "id" TEXT NOT NULL,
    "reason" "RetentionCaseReason" NOT NULL,
    "triggerUserId" TEXT,
    "triggerRetainedIdentityId" TEXT,
    "sourceTable" TEXT,
    "sourceId" TEXT,
    "retentionHoldUntil" TIMESTAMPTZ(3),
    "legalHoldReason" "LegalHoldReason",
    "approvalReference" TEXT,
    "policyVersion" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetentionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetainedVaultObject" (
    "id" TEXT NOT NULL,
    "target" "RetainedVaultObjectTarget" NOT NULL,
    "sourceTable" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "archiveJobId" TEXT,
    "subjectUserId" TEXT,
    "subjectRetainedIdentityId" TEXT,
    "subjectParticipantId" TEXT,
    "subjectRole" "RetainedVaultSubjectRole" NOT NULL,
    "payloadSchemaVersion" INTEGER NOT NULL,
    "encryptedPayload" JSONB,
    "payloadDigest" TEXT,
    "keyPurpose" TEXT NOT NULL,
    "keyVersion" TEXT,
    "aad" TEXT NOT NULL,
    "state" "RetainedVaultObjectState" NOT NULL DEFAULT 'RETAINED',
    "retainedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disposedAt" TIMESTAMPTZ(3),
    "disposalReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetainedVaultObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetainedVaultObjectHold" (
    "id" TEXT NOT NULL,
    "retainedVaultObjectId" TEXT NOT NULL,
    "retentionCaseId" TEXT NOT NULL,
    "holdReason" "RetentionCaseReason" NOT NULL,
    "holdUntil" TIMESTAMPTZ(3),
    "releasedAt" TIMESTAMPTZ(3),
    "releaseReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetainedVaultObjectHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetainedIdentityHold" (
    "id" TEXT NOT NULL,
    "retainedIdentityId" TEXT NOT NULL,
    "retentionCaseId" TEXT NOT NULL,
    "holdReason" "RetentionCaseReason" NOT NULL,
    "holdUntil" TIMESTAMPTZ(3),
    "releasedAt" TIMESTAMPTZ(3),
    "releaseReason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetainedIdentityHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionAccessLog" (
    "id" TEXT NOT NULL,
    "targetType" "RetentionAccessTargetType" NOT NULL,
    "retainedIdentityId" TEXT,
    "retainedVaultObjectId" TEXT,
    "vaultTarget" "RetainedVaultObjectTarget",
    "accessedBy" TEXT,
    "accessReason" "RetentionAccessReason" NOT NULL,
    "approvalReference" TEXT,
    "purpose" TEXT,
    "result" "RetentionAccessResult" NOT NULL,
    "disclosedFields" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logRetentionHoldUntil" TIMESTAMPTZ(3),
    "logRetentionDisposedAt" TIMESTAMPTZ(3),
    "logRetentionDisposalReason" TEXT,

    CONSTRAINT "RetentionAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RetentionReviewJob" (
    "id" TEXT NOT NULL,
    "target" "RetentionReviewJobTarget" NOT NULL,
    "status" "ArchiveJobStatus" NOT NULL DEFAULT 'PENDING',
    "sourceId" TEXT NOT NULL,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "payload" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastErrorCode" TEXT,
    "lastAttemptAt" TIMESTAMPTZ(3),
    "lastSucceededAt" TIMESTAMPTZ(3),
    "manualReviewRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetentionReviewJob_pkey" PRIMARY KEY ("id")
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
    "sessionTokenHash" TEXT,
    "sessionTokenExpiresAt" TIMESTAMPTZ(3),
    "refreshTokenHash" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSecurityEvent" (
    "id" TEXT NOT NULL,
    "type" "AuthSecurityEventType" NOT NULL,
    "severity" "AuthSecurityEventSeverity" NOT NULL DEFAULT 'INFO',
    "actorUserId" TEXT,
    "targetUserId" TEXT,
    "sessionId" TEXT,
    "emailHash" TEXT,
    "requestIpHash" TEXT,
    "userAgentHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSecurityEvent_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "SeasonOperationAuditEvent_seasonId_createdAt_idx" ON "SeasonOperationAuditEvent"("seasonId", "createdAt");

-- CreateIndex
CREATE INDEX "SeasonOperationAuditEvent_campusCode_createdAt_idx" ON "SeasonOperationAuditEvent"("campusCode", "createdAt");

-- CreateIndex
CREATE INDEX "SeasonOperationAuditEvent_action_createdAt_idx" ON "SeasonOperationAuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "SeasonOperationAuditEvent_actorUserId_createdAt_idx" ON "SeasonOperationAuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "SeasonDormitoryOperation_seasonId_isOperated_roomSelectionD_idx" ON "SeasonDormitoryOperation"("seasonId", "isOperated", "roomSelectionDate");

-- CreateIndex
CREATE INDEX "SeasonDormitoryOperation_dormitoryId_roomSelectionDate_idx" ON "SeasonDormitoryOperation"("dormitoryId", "roomSelectionDate");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "UserDisplayIdentity_nicknameNormalized_key" ON "UserDisplayIdentity"("nicknameNormalized");

-- CreateIndex
CREATE INDEX "UserDisplayIdentity_nickname_idx" ON "UserDisplayIdentity"("nickname");

-- CreateIndex
CREATE INDEX "UserAcademicIdentity_collegeCode_idx" ON "UserAcademicIdentity"("collegeCode");

-- CreateIndex
CREATE INDEX "UserAcademicIdentity_birthYear_idx" ON "UserAcademicIdentity"("birthYear");

-- CreateIndex
CREATE INDEX "UserAcademicIdentityChangeAllowance_academicYear_idx" ON "UserAcademicIdentityChangeAllowance"("academicYear");

-- CreateIndex
CREATE INDEX "UserDismissedNotice_noticeKey_dismissedAt_idx" ON "UserDismissedNotice"("noticeKey", "dismissedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RetainedIdentity_originalUserId_key" ON "RetainedIdentity"("originalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RetainedIdentity_anonymizedActorKey_key" ON "RetainedIdentity"("anonymizedActorKey");

-- CreateIndex
CREATE INDEX "RetainedIdentity_deletedAt_idx" ON "RetainedIdentity"("deletedAt");

-- CreateIndex
CREATE INDEX "RetainedIdentity_retentionDisposedAt_deletedAt_idx" ON "RetainedIdentity"("retentionDisposedAt", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserDisplayIdentityNicknameChangeEvent_retainedVaultObjectI_key" ON "UserDisplayIdentityNicknameChangeEvent"("retainedVaultObjectId");

-- CreateIndex
CREATE INDEX "UserDisplayIdentityNicknameChangeEvent_userId_changedAt_idx" ON "UserDisplayIdentityNicknameChangeEvent"("userId", "changedAt");

-- CreateIndex
CREATE INDEX "UserDisplayIdentityNicknameChangeEvent_source_changedAt_idx" ON "UserDisplayIdentityNicknameChangeEvent"("source", "changedAt");

-- CreateIndex
CREATE INDEX "UserDisplayIdentityNicknameChangeEvent_actorType_actorId_ch_idx" ON "UserDisplayIdentityNicknameChangeEvent"("actorType", "actorId", "changedAt");

-- CreateIndex
CREATE INDEX "UserDisplayIdentityNicknameChangeEvent_retainedIdentityId_c_idx" ON "UserDisplayIdentityNicknameChangeEvent"("retainedIdentityId", "changedAt");

-- CreateIndex
CREATE INDEX "UserDisplayIdentityNicknameChangeEvent_retainedVaultObjectI_idx" ON "UserDisplayIdentityNicknameChangeEvent"("retainedVaultObjectId");

-- CreateIndex
CREATE INDEX "UserDisplayIdentityNicknameChangeEvent_redactedAt_idx" ON "UserDisplayIdentityNicknameChangeEvent"("redactedAt");

-- CreateIndex
CREATE INDEX "UserDisplayIdentityNicknameChangeEvent_reportId_idx" ON "UserDisplayIdentityNicknameChangeEvent"("reportId");

-- CreateIndex
CREATE INDEX "UserDisplayIdentityNicknameChangeEvent_moderationCaseId_idx" ON "UserDisplayIdentityNicknameChangeEvent"("moderationCaseId");

-- CreateIndex
CREATE INDEX "UserDisplayIdentityNicknameChangeEvent_sanctionId_idx" ON "UserDisplayIdentityNicknameChangeEvent"("sanctionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAcademicIdentityChangeEvent_retainedVaultObjectI_key" ON "UserAcademicIdentityChangeEvent"("retainedVaultObjectId");

-- CreateIndex
CREATE INDEX "UserAcademicIdentityChangeEvent_userId_changedAt_idx" ON "UserAcademicIdentityChangeEvent"("userId", "changedAt");

-- CreateIndex
CREATE INDEX "UserAcademicIdentityChangeEvent_source_changedAt_idx" ON "UserAcademicIdentityChangeEvent"("source", "changedAt");

-- CreateIndex
CREATE INDEX "UserAcademicIdentityChangeEvent_actorType_actorId_ch_idx" ON "UserAcademicIdentityChangeEvent"("actorType", "actorId", "changedAt");

-- CreateIndex
CREATE INDEX "UserAcademicIdentityChangeEvent_retainedIdentityId_c_idx" ON "UserAcademicIdentityChangeEvent"("retainedIdentityId", "changedAt");

-- CreateIndex
CREATE INDEX "UserAcademicIdentityChangeEvent_retainedVaultObjectI_idx" ON "UserAcademicIdentityChangeEvent"("retainedVaultObjectId");

-- CreateIndex
CREATE INDEX "UserAcademicIdentityChangeEvent_redactedAt_idx" ON "UserAcademicIdentityChangeEvent"("redactedAt");

-- CreateIndex
CREATE INDEX "UserAcademicIdentityChangeEvent_reportId_idx" ON "UserAcademicIdentityChangeEvent"("reportId");

-- CreateIndex
CREATE INDEX "UserAcademicIdentityChangeEvent_moderationCaseId_idx" ON "UserAcademicIdentityChangeEvent"("moderationCaseId");

-- CreateIndex
CREATE INDEX "UserAcademicIdentityChangeEvent_sanctionId_idx" ON "UserAcademicIdentityChangeEvent"("sanctionId");

-- CreateIndex
CREATE INDEX "ArchiveJob_status_nextRunAt_idx" ON "ArchiveJob"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "ArchiveJob_retainedIdentityId_target_idx" ON "ArchiveJob"("retainedIdentityId", "target");

-- CreateIndex
CREATE INDEX "ArchiveJob_target_manualReviewRequired_idx" ON "ArchiveJob"("target", "manualReviewRequired");

-- CreateIndex
CREATE INDEX "ArchiveJob_userId_target_idx" ON "ArchiveJob"("userId", "target");

-- CreateIndex
CREATE INDEX "SeasonParticipant_userId_seasonId_idx" ON "SeasonParticipant"("userId", "seasonId");

-- CreateIndex
CREATE INDEX "SeasonParticipant_seasonId_dormitoryId_dormitorySelectionSt_idx" ON "SeasonParticipant"("seasonId", "dormitoryId", "dormitorySelectionState");

-- CreateIndex
CREATE INDEX "SeasonParticipant_seasonId_participantStatus_idx" ON "SeasonParticipant"("seasonId", "participantStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonParticipant_seasonId_userId_key" ON "SeasonParticipant"("seasonId", "userId");

-- CreateIndex
CREATE INDEX "UserBookmark_viewerUserId_seasonId_deletedAt_expiredAt_b_idx" ON "UserBookmark"("viewerUserId", "seasonId", "deletedAt", "expiredAt", "bookmarkedAt", "id");

-- CreateIndex
CREATE INDEX "UserBookmark_targetUserId_seasonId_deletedAt_expiredAt_idx" ON "UserBookmark"("targetUserId", "seasonId", "deletedAt", "expiredAt");

-- CreateIndex
CREATE INDEX "UserBookmark_viewerUserId_targetUserId_seasonId_delet_idx" ON "UserBookmark"("viewerUserId", "targetUserId", "seasonId", "deletedAt", "expiredAt");

-- CreateIndex
CREATE INDEX "UserBookmark_targetParticipantId_deletedAt_expiredAt_idx" ON "UserBookmark"("targetParticipantId", "deletedAt", "expiredAt");

-- CreateIndex
CREATE INDEX "UserBlock_blockerUserId_unblockedAt_blockedAt_id_idx" ON "UserBlock"("blockerUserId", "unblockedAt", "blockedAt", "id");

-- CreateIndex
CREATE INDEX "UserBlock_blockedUserId_unblockedAt_blockedAt_id_idx" ON "UserBlock"("blockedUserId", "unblockedAt", "blockedAt", "id");

-- CreateIndex
CREATE INDEX "UserBlock_blockerUserId_blockedUserId_unblockedAt_idx" ON "UserBlock"("blockerUserId", "blockedUserId", "unblockedAt");

-- CreateIndex
CREATE INDEX "UserBlockEvent_blockId_occurredAt_id_idx" ON "UserBlockEvent"("blockId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "UserBlockEvent_actorUserId_occurredAt_id_idx" ON "UserBlockEvent"("actorUserId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "UserBlockEvent_targetUserId_occurredAt_id_idx" ON "UserBlockEvent"("targetUserId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "ReportCase_reporterUserId_receivedAt_id_idx" ON "ReportCase"("reporterUserId", "receivedAt", "id");

-- CreateIndex
CREATE INDEX "ReportCase_targetType_targetId_status_receivedAt_id_idx" ON "ReportCase"("targetType", "targetId", "status", "receivedAt", "id");

-- CreateIndex
CREATE INDEX "ReportCase_targetUserId_status_receivedAt_id_idx" ON "ReportCase"("targetUserId", "status", "receivedAt", "id");

-- CreateIndex
CREATE INDEX "ReportCase_status_riskTier_receivedAt_id_idx" ON "ReportCase"("status", "riskTier", "receivedAt", "id");

-- CreateIndex
CREATE INDEX "ReportCase_targetParticipantId_status_receivedAt_id_idx" ON "ReportCase"("targetParticipantId", "status", "receivedAt", "id");

-- CreateIndex
CREATE INDEX "ReportCase_targetThreadId_status_receivedAt_id_idx" ON "ReportCase"("targetThreadId", "status", "receivedAt", "id");

-- CreateIndex
CREATE INDEX "ReportCase_targetMessageId_status_receivedAt_id_idx" ON "ReportCase"("targetMessageId", "status", "receivedAt", "id");

-- CreateIndex
CREATE INDEX "ReportCase_targetMatchRequestId_status_receivedAt_id_idx" ON "ReportCase"("targetMatchRequestId", "status", "receivedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ReportCase_reporter_target_reason_open_key"
  ON "ReportCase"("reporterUserId", "targetType", "targetId", "reason")
  WHERE "status" IN ('SUBMITTED', 'EVIDENCE_ONLY');

-- CreateIndex
CREATE INDEX "ReportCaseEvent_reportCaseId_occurredAt_id_idx" ON "ReportCaseEvent"("reportCaseId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "ReportCaseEvent_actorUserId_occurredAt_id_idx" ON "ReportCaseEvent"("actorUserId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "ReportCaseEvent_eventType_occurredAt_id_idx" ON "ReportCaseEvent"("eventType", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "SeasonParticipantLifecycleEvent_participantId_occurredAt_idx" ON "SeasonParticipantLifecycleEvent"("participantId", "occurredAt");

-- CreateIndex
CREATE INDEX "SeasonParticipantLifecycleEvent_seasonId_eventType_occurred_idx" ON "SeasonParticipantLifecycleEvent"("seasonId", "eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "SeasonParticipantLifecycleEvent_userId_occurredAt_idx" ON "SeasonParticipantLifecycleEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "SeasonParticipantLifecycleEvent_eventType_occurredAt_idx" ON "SeasonParticipantLifecycleEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "SeasonParticipantLifecycleEvent_createdAt_idx" ON "SeasonParticipantLifecycleEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SeasonParticipantProfile_collegeCode_idx" ON "SeasonParticipantProfile"("collegeCode");

-- CreateIndex
CREATE INDEX "SeasonParticipantProfile_nicknameNormalizedSnapshot_idx" ON "SeasonParticipantProfile"("nicknameNormalizedSnapshot");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonParticipantProfileHistory_retainedVaultObjectId_key" ON "SeasonParticipantProfileHistory"("retainedVaultObjectId");

-- CreateIndex
CREATE INDEX "SeasonParticipantProfileHistory_participantId_createdAt_idx" ON "SeasonParticipantProfileHistory"("participantId", "createdAt");

-- CreateIndex
CREATE INDEX "SeasonParticipantProfileHistory_seasonId_participantId_crea_idx" ON "SeasonParticipantProfileHistory"("seasonId", "participantId", "createdAt");

-- CreateIndex
CREATE INDEX "SeasonParticipantProfileHistory_retainedIdentityId_createdA_idx" ON "SeasonParticipantProfileHistory"("retainedIdentityId", "createdAt");

-- CreateIndex
CREATE INDEX "SeasonParticipantProfileHistory_retainedVaultObjectId_idx" ON "SeasonParticipantProfileHistory"("retainedVaultObjectId");

-- CreateIndex
CREATE INDEX "SeasonParticipantProfileHistory_redactedAt_idx" ON "SeasonParticipantProfileHistory"("redactedAt");

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
CREATE INDEX "ConversationThreadMember_participantId_memberState_updatedAt_idx" ON "ConversationThreadMember"("participantId", "memberState", "updatedAt");
CREATE INDEX "ConversationThreadMember_participantId_memberState_threadId_idx" ON "ConversationThreadMember"("participantId", "memberState", "threadId");

-- CreateIndex
CREATE INDEX "ConversationThreadMember_participantId_lastVisibleAt_idx" ON "ConversationThreadMember"("participantId", "lastVisibleAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMessage_retainedVaultObjectId_key" ON "ConversationMessage"("retainedVaultObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMessage_senderParticipantId_clientMessageId_key" ON "ConversationMessage"("senderParticipantId", "clientMessageId");

-- CreateIndex
CREATE INDEX "ConversationMessage_threadId_sentAt_idx" ON "ConversationMessage"("threadId", "sentAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_threadId_sentAt_id_idx" ON "ConversationMessage"("threadId", "sentAt", "id");

-- CreateIndex
CREATE INDEX "ConversationMessage_senderParticipantId_sentAt_idx" ON "ConversationMessage"("senderParticipantId", "sentAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_senderParticipantId_sentAt_id_idx" ON "ConversationMessage"("senderParticipantId", "sentAt", "id");

-- CreateIndex
CREATE INDEX "ConversationMessage_bodyState_tombstonedAt_idx" ON "ConversationMessage"("bodyState", "tombstonedAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_retainedVaultObjectId_idx" ON "ConversationMessage"("retainedVaultObjectId");

-- CreateIndex
CREATE INDEX "ChatRealtimeOutboxEvent_publishedAt_availableAt_occurredAt_id_idx" ON "ChatRealtimeOutboxEvent"("publishedAt", "availableAt", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "ChatRealtimeOutboxEvent_threadId_occurredAt_id_idx" ON "ChatRealtimeOutboxEvent"("threadId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "ChatRealtimeOutboxEvent_aggregateType_aggregateId_occurredAt_id_idx" ON "ChatRealtimeOutboxEvent"("aggregateType", "aggregateId", "occurredAt", "id");

-- CreateIndex
CREATE INDEX "ChatRealtimeEventRecipient_userId_createdAt_eventId_idx" ON "ChatRealtimeEventRecipient"("userId", "createdAt", "eventId");

-- CreateIndex
CREATE INDEX "ChatRealtimeEventRecipient_userId_cursor_idx" ON "ChatRealtimeEventRecipient"("userId", "cursor");

-- CreateIndex
CREATE INDEX "ChatRealtimeEventRecipient_threadId_createdAt_eventId_idx" ON "ChatRealtimeEventRecipient"("threadId", "createdAt", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotification_recipientUserId_kind_sourceType_sourceId_key" ON "UserNotification"("recipientUserId", "kind", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "UserNotification_recipientUserId_readAt_createdAt_id_idx" ON "UserNotification"("recipientUserId", "readAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "UserNotification_recipientUserId_createdAt_id_idx" ON "UserNotification"("recipientUserId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "UserNotification_actorUserId_createdAt_id_idx" ON "UserNotification"("actorUserId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationCampaign_kind_sourceType_sourceId_key" ON "NotificationCampaign"("kind", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "NotificationCampaign_status_createdAt_id_idx" ON "NotificationCampaign"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "NotificationCampaign_targetSeasonId_status_createdAt_id_idx" ON "NotificationCampaign"("targetSeasonId", "status", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorAlert_sourceType_sourceId_category_key" ON "OperatorAlert"("sourceType", "sourceId", "category");

-- CreateIndex
CREATE INDEX "OperatorAlert_status_createdAt_id_idx" ON "OperatorAlert"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "OperatorAlert_category_riskTier_createdAt_id_idx" ON "OperatorAlert"("category", "riskTier", "createdAt", "id");

-- CreateIndex
CREATE INDEX "NotificationOutboxEvent_status_availableAt_createdAt_id_idx" ON "NotificationOutboxEvent"("status", "availableAt", "createdAt", "id");

-- CreateIndex
CREATE INDEX "NotificationOutboxEvent_notificationId_createdAt_id_idx" ON "NotificationOutboxEvent"("notificationId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "NotificationOutboxEvent_recipientUserId_createdAt_id_idx" ON "NotificationOutboxEvent"("recipientUserId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonMatchHistoryEntryRetentionLink_retainedVaultObjectId_key" ON "SeasonMatchHistoryEntryRetentionLink"("retainedVaultObjectId");

-- CreateIndex
CREATE INDEX "SeasonMatchHistoryEntryRetentionLink_retainedIdentityId_sub_idx" ON "SeasonMatchHistoryEntryRetentionLink"("retainedIdentityId", "subjectRole");

-- CreateIndex
CREATE INDEX "SeasonMatchHistoryEntryRetentionLink_participantId_idx" ON "SeasonMatchHistoryEntryRetentionLink"("participantId");

-- CreateIndex
CREATE INDEX "SeasonMatchHistoryEntryRetentionLink_userId_idx" ON "SeasonMatchHistoryEntryRetentionLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonMatchHistoryEntryRetentionLink_matchHistoryEntryId_re_key" ON "SeasonMatchHistoryEntryRetentionLink"("matchHistoryEntryId", "retainedIdentityId", "subjectRole");

-- CreateIndex
CREATE INDEX "RetentionCase_reason_retentionHoldUntil_idx" ON "RetentionCase"("reason", "retentionHoldUntil");

-- CreateIndex
CREATE INDEX "RetentionCase_triggerRetainedIdentityId_reason_idx" ON "RetentionCase"("triggerRetainedIdentityId", "reason");

-- CreateIndex
CREATE INDEX "RetentionCase_sourceTable_sourceId_idx" ON "RetentionCase"("sourceTable", "sourceId");

-- CreateIndex
CREATE INDEX "RetainedVaultObject_target_sourceId_idx" ON "RetainedVaultObject"("target", "sourceId");

-- CreateIndex
CREATE INDEX "RetainedVaultObject_archiveJobId_idx" ON "RetainedVaultObject"("archiveJobId");

-- CreateIndex
CREATE INDEX "RetainedVaultObject_subjectRetainedIdentityId_target_retain_idx" ON "RetainedVaultObject"("subjectRetainedIdentityId", "target", "retainedAt");

-- CreateIndex
CREATE INDEX "RetainedVaultObject_state_retainedAt_idx" ON "RetainedVaultObject"("state", "retainedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RetainedVaultObject_target_sourceId_subjectRole_key" ON "RetainedVaultObject"("target", "sourceId", "subjectRole");

-- CreateIndex
CREATE INDEX "RetainedVaultObjectHold_retentionCaseId_holdUntil_idx" ON "RetainedVaultObjectHold"("retentionCaseId", "holdUntil");

-- CreateIndex
CREATE INDEX "RetainedVaultObjectHold_holdReason_holdUntil_idx" ON "RetainedVaultObjectHold"("holdReason", "holdUntil");

-- CreateIndex
CREATE UNIQUE INDEX "RetainedVaultObjectHold_retainedVaultObjectId_retentionCase_key" ON "RetainedVaultObjectHold"("retainedVaultObjectId", "retentionCaseId");

-- CreateIndex
CREATE INDEX "RetainedIdentityHold_retentionCaseId_holdUntil_idx" ON "RetainedIdentityHold"("retentionCaseId", "holdUntil");

-- CreateIndex
CREATE INDEX "RetainedIdentityHold_holdReason_holdUntil_idx" ON "RetainedIdentityHold"("holdReason", "holdUntil");

-- CreateIndex
CREATE UNIQUE INDEX "RetainedIdentityHold_retainedIdentityId_retentionCaseId_key" ON "RetainedIdentityHold"("retainedIdentityId", "retentionCaseId");

-- CreateIndex
CREATE INDEX "RetentionAccessLog_retainedIdentityId_createdAt_idx" ON "RetentionAccessLog"("retainedIdentityId", "createdAt");

-- CreateIndex
CREATE INDEX "RetentionAccessLog_retainedVaultObjectId_createdAt_idx" ON "RetentionAccessLog"("retainedVaultObjectId", "createdAt");

-- CreateIndex
CREATE INDEX "RetentionAccessLog_targetType_accessReason_createdAt_idx" ON "RetentionAccessLog"("targetType", "accessReason", "createdAt");

-- CreateIndex
CREATE INDEX "RetentionAccessLog_vaultTarget_accessReason_createdAt_idx" ON "RetentionAccessLog"("vaultTarget", "accessReason", "createdAt");

-- CreateIndex
CREATE INDEX "RetentionAccessLog_accessedBy_createdAt_idx" ON "RetentionAccessLog"("accessedBy", "createdAt");

-- CreateIndex
CREATE INDEX "RetentionAccessLog_logRetentionHoldUntil_logRetentionDispos_idx" ON "RetentionAccessLog"("logRetentionHoldUntil", "logRetentionDisposedAt");

-- CreateIndex
CREATE INDEX "RetentionReviewJob_status_dueAt_idx" ON "RetentionReviewJob"("status", "dueAt");

-- CreateIndex
CREATE INDEX "RetentionReviewJob_target_status_dueAt_idx" ON "RetentionReviewJob"("target", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionReviewJob_target_sourceId_key" ON "RetentionReviewJob"("target", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "LoginAttempt_emailNormalized_key" ON "LoginAttempt"("emailNormalized");

-- CreateIndex
CREATE INDEX "LoginAttempt_lastFailedAt_idx" ON "LoginAttempt"("lastFailedAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_lockedUntil_idx" ON "LoginAttempt"("lockedUntil");

-- CreateIndex
CREATE INDEX "VerificationCode_emailNormalized_purpose_idx" ON "VerificationCode"("emailNormalized", "purpose");

-- CreateIndex
CREATE INDEX "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");

-- CreateIndex
CREATE INDEX "VerificationCode_consumedAt_idx" ON "VerificationCode"("consumedAt");

-- CreateIndex
CREATE INDEX "VerificationCodeRequestLog_emailNormalized_purpose_requestI_idx" ON "VerificationCodeRequestLog"("emailNormalized", "purpose", "requestIp", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationCodeRequestLog_requestIp_createdAt_idx" ON "VerificationCodeRequestLog"("requestIp", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationCodeRequestLog_createdAt_idx" ON "VerificationCodeRequestLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_sessionTokenHash_key" ON "AuthSession"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_userId_revokedAt_expiresAt_idx" ON "AuthSession"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_revokedAt_idx" ON "AuthSession"("revokedAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_type_createdAt_idx" ON "AuthSecurityEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_severity_createdAt_idx" ON "AuthSecurityEvent"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_actorUserId_createdAt_idx" ON "AuthSecurityEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_targetUserId_createdAt_idx" ON "AuthSecurityEvent"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_emailHash_type_createdAt_idx" ON "AuthSecurityEvent"("emailHash", "type", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_sessionId_createdAt_idx" ON "AuthSecurityEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AuthSecurityEvent_createdAt_idx" ON "AuthSecurityEvent"("createdAt");

-- CreateIndex
CREATE INDEX "ModerationTerm_surface_category_isActive_idx" ON "ModerationTerm"("surface", "category", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationTerm_normalizedTerm_category_matchMode_surface_key" ON "ModerationTerm"("normalizedTerm", "category", "matchMode", "surface");

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
ALTER TABLE "SeasonOperationAuditEvent" ADD CONSTRAINT "SeasonOperationAuditEvent_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDormitoryOperation" ADD CONSTRAINT "SeasonDormitoryOperation_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonDormitoryOperation" ADD CONSTRAINT "SeasonDormitoryOperation_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES "Dormitory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDisplayIdentity" ADD CONSTRAINT "UserDisplayIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAcademicIdentity" ADD CONSTRAINT "UserAcademicIdentity_collegeCode_fkey" FOREIGN KEY ("collegeCode") REFERENCES "CollegeMaster"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAcademicIdentity" ADD CONSTRAINT "UserAcademicIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAcademicIdentityChangeAllowance" ADD CONSTRAINT "UserAcademicIdentityChangeAllowance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDismissedNotice" ADD CONSTRAINT "UserDismissedNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDisplayIdentityNicknameChangeEvent" ADD CONSTRAINT "UserDisplayIdentityNicknameChangeEvent_retainedIdentityId_fkey" FOREIGN KEY ("retainedIdentityId") REFERENCES "RetainedIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDisplayIdentityNicknameChangeEvent" ADD CONSTRAINT "UserDisplayIdentityNicknameChangeEvent_retainedVaultObject_fkey" FOREIGN KEY ("retainedVaultObjectId") REFERENCES "RetainedVaultObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDisplayIdentityNicknameChangeEvent" ADD CONSTRAINT "UserDisplayIdentityNicknameChangeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAcademicIdentityChangeEvent" ADD CONSTRAINT "UserAcademicIdentityChangeEvent_retainedIdentityId_fkey" FOREIGN KEY ("retainedIdentityId") REFERENCES "RetainedIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAcademicIdentityChangeEvent" ADD CONSTRAINT "UserAcademicIdentityChangeEvent_retainedVaultObject_fkey" FOREIGN KEY ("retainedVaultObjectId") REFERENCES "RetainedVaultObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAcademicIdentityChangeEvent" ADD CONSTRAINT "UserAcademicIdentityChangeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchiveJob" ADD CONSTRAINT "ArchiveJob_retainedIdentityId_fkey" FOREIGN KEY ("retainedIdentityId") REFERENCES "RetainedIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipant" ADD CONSTRAINT "SeasonParticipant_dormitoryId_fkey" FOREIGN KEY ("dormitoryId") REFERENCES "Dormitory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipant" ADD CONSTRAINT "SeasonParticipant_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipant" ADD CONSTRAINT "SeasonParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookmark" ADD CONSTRAINT "UserBookmark_viewerUserId_fkey" FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookmark" ADD CONSTRAINT "UserBookmark_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookmark" ADD CONSTRAINT "UserBookmark_targetParticipantId_fkey" FOREIGN KEY ("targetParticipantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookmark" ADD CONSTRAINT "UserBookmark_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerUserId_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlockEvent" ADD CONSTRAINT "UserBlockEvent_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "UserBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlockEvent" ADD CONSTRAINT "UserBlockEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlockEvent" ADD CONSTRAINT "UserBlockEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportCaseEvent" ADD CONSTRAINT "ReportCaseEvent_reportCaseId_fkey" FOREIGN KEY ("reportCaseId") REFERENCES "ReportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipantLifecycleEvent" ADD CONSTRAINT "SeasonParticipantLifecycleEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipantProfile" ADD CONSTRAINT "SeasonParticipantProfile_collegeCode_fkey" FOREIGN KEY ("collegeCode") REFERENCES "CollegeMaster"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipantProfile" ADD CONSTRAINT "SeasonParticipantProfile_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "SeasonParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonParticipantProfileHistory" ADD CONSTRAINT "SeasonParticipantProfileHistory_retainedVaultObjectId_fkey" FOREIGN KEY ("retainedVaultObjectId") REFERENCES "RetainedVaultObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_retainedVaultObjectId_fkey" FOREIGN KEY ("retainedVaultObjectId") REFERENCES "RetainedVaultObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatRealtimeEventRecipient" ADD CONSTRAINT "ChatRealtimeEventRecipient_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ChatRealtimeOutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNotification" ADD CONSTRAINT "UserNotification_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationOutboxEvent" ADD CONSTRAINT "NotificationOutboxEvent_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "UserNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationOutboxEvent" ADD CONSTRAINT "NotificationOutboxEvent_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMatchHistoryEntryRetentionLink" ADD CONSTRAINT "SeasonMatchHistoryEntryRetentionLink_matchHistoryEntryId_fkey" FOREIGN KEY ("matchHistoryEntryId") REFERENCES "SeasonMatchHistoryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonMatchHistoryEntryRetentionLink" ADD CONSTRAINT "SeasonMatchHistoryEntryRetentionLink_retainedVaultObjectId_fkey" FOREIGN KEY ("retainedVaultObjectId") REFERENCES "RetainedVaultObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionCase" ADD CONSTRAINT "RetentionCase_triggerRetainedIdentityId_fkey" FOREIGN KEY ("triggerRetainedIdentityId") REFERENCES "RetainedIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainedVaultObject" ADD CONSTRAINT "RetainedVaultObject_archiveJobId_fkey" FOREIGN KEY ("archiveJobId") REFERENCES "ArchiveJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainedVaultObject" ADD CONSTRAINT "RetainedVaultObject_subjectRetainedIdentityId_fkey" FOREIGN KEY ("subjectRetainedIdentityId") REFERENCES "RetainedIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainedVaultObjectHold" ADD CONSTRAINT "RetainedVaultObjectHold_retainedVaultObjectId_fkey" FOREIGN KEY ("retainedVaultObjectId") REFERENCES "RetainedVaultObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainedVaultObjectHold" ADD CONSTRAINT "RetainedVaultObjectHold_retentionCaseId_fkey" FOREIGN KEY ("retentionCaseId") REFERENCES "RetentionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainedIdentityHold" ADD CONSTRAINT "RetainedIdentityHold_retainedIdentityId_fkey" FOREIGN KEY ("retainedIdentityId") REFERENCES "RetainedIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetainedIdentityHold" ADD CONSTRAINT "RetainedIdentityHold_retentionCaseId_fkey" FOREIGN KEY ("retentionCaseId") REFERENCES "RetentionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionAccessLog" ADD CONSTRAINT "RetentionAccessLog_retainedIdentityId_fkey" FOREIGN KEY ("retainedIdentityId") REFERENCES "RetainedIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetentionAccessLog" ADD CONSTRAINT "RetentionAccessLog_retainedVaultObjectId_fkey" FOREIGN KEY ("retainedVaultObjectId") REFERENCES "RetainedVaultObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Manual check constraints not represented by Prisma schema DSL
ALTER TABLE "UserAcademicIdentity"
  ADD CONSTRAINT "UserAcademicIdentity_birthYear_check"
  CHECK ("birthYear" >= 1980);

ALTER TABLE "UserAcademicIdentityChangeAllowance"
  ADD CONSTRAINT "UserAcademicIdentityChangeAllowance_collegeChangeRemaining_check"
  CHECK ("collegeChangeRemaining" >= 0);

ALTER TABLE "SeasonParticipantProfile"
  ADD CONSTRAINT "SeasonParticipantProfile_grade_check"
  CHECK ("grade" IS NULL OR "grade" IN ('1', '2', '3', '4+'));

ALTER TABLE "SeasonParticipantProfileHistory"
  ADD CONSTRAINT "SeasonParticipantProfileHistory_grade_check"
  CHECK ("grade" IS NULL OR "grade" IN ('1', '2', '3', '4+'));

ALTER TABLE "SeasonParticipantProfile"
  ADD CONSTRAINT "SeasonParticipantProfile_birthYear_check"
  CHECK ("birthYear" IS NULL OR "birthYear" >= 1980);

ALTER TABLE "SeasonParticipantProfileHistory"
  ADD CONSTRAINT "SeasonParticipantProfileHistory_birthYear_check"
  CHECK ("birthYear" IS NULL OR "birthYear" >= 1980);

ALTER TABLE "ConversationMessage"
  ADD CONSTRAINT "ConversationMessage_body_length_check"
  CHECK (char_length("body") BETWEEN 1 AND 1000);

-- Baseline partial unique indexes not represented by Prisma schema DSL
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

CREATE UNIQUE INDEX "UserBookmark_viewerUserId_seasonId_targetParticipant_active_key"
  ON "UserBookmark"("viewerUserId", "seasonId", "targetParticipantId")
  WHERE "deletedAt" IS NULL AND "expiredAt" IS NULL;

CREATE INDEX "UserBookmark_active_list_cursor_idx"
  ON "UserBookmark"("viewerUserId", "seasonId", "bookmarkedAt" DESC, "id" DESC)
  WHERE "deletedAt" IS NULL AND "expiredAt" IS NULL;

CREATE INDEX "UserBookmark_active_target_reverse_idx"
  ON "UserBookmark"("targetUserId", "seasonId")
  WHERE "deletedAt" IS NULL AND "expiredAt" IS NULL;

CREATE INDEX "UserBookmark_active_block_cleanup_idx"
  ON "UserBookmark"("viewerUserId", "targetUserId", "seasonId")
  WHERE "deletedAt" IS NULL AND "expiredAt" IS NULL;

CREATE UNIQUE INDEX "UserBlock_blockerUserId_blockedUserId_active_key"
  ON "UserBlock"("blockerUserId", "blockedUserId")
  WHERE "unblockedAt" IS NULL;

CREATE INDEX "UserBlock_active_list_cursor_idx"
  ON "UserBlock"("blockerUserId", "blockedAt" DESC, "id" DESC)
  WHERE "unblockedAt" IS NULL;

CREATE INDEX "UserBlock_active_reverse_lookup_idx"
  ON "UserBlock"("blockedUserId", "blockerUserId")
  WHERE "unblockedAt" IS NULL;
