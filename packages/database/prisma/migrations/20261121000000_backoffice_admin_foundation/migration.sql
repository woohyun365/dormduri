-- CreateEnum
CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "AdminInvitationKind" AS ENUM ('BOOTSTRAP_OWNER', 'OPERATOR');

-- CreateEnum
CREATE TYPE "AdminPasskeyDeviceType" AS ENUM ('SINGLE_DEVICE', 'MULTI_DEVICE');

-- CreateEnum
CREATE TYPE "AdminSessionScope" AS ENUM ('FULL', 'RECOVERY');

-- CreateEnum
CREATE TYPE "AdminSessionRevocationReason" AS ENUM ('LOGOUT', 'ROLE_REVOKED', 'ACCOUNT_LOCKED', 'ACCOUNT_DEACTIVATED');

-- CreateEnum
CREATE TYPE "AdminWebAuthnChallengePurpose" AS ENUM ('REGISTRATION', 'AUTHENTICATION', 'REAUTHENTICATION');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'AUDITOR', 'LEGAL_EDITOR', 'LEGAL_APPROVER');

-- CreateEnum
CREATE TYPE "AdminApprovalRequestKind" AS ENUM ('ROLE_GRANT', 'ROLE_REVOKE');

-- CreateEnum
CREATE TYPE "AdminApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AdminAuditActorType" AS ENUM ('ADMIN', 'SYSTEM', 'ANONYMOUS');

-- CreateEnum
CREATE TYPE "AdminAuditAccessPath" AS ENUM ('SSM_PORT_FORWARD');

-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'SESSION_EXPIRED', 'ACCOUNT_LOCKED', 'REAUTHENTICATE', 'PASSKEY_REGISTER', 'TOTP_ENROLL', 'RECOVERY_CODES_ISSUE', 'INVITATION_CREATE', 'INVITATION_REVOKE', 'INVITATION_ACCEPT', 'ACCESS_REQUEST_CREATE', 'ACCESS_REQUEST_APPROVE', 'ACCESS_REQUEST_REJECT', 'ACCESS_REQUEST_CANCEL', 'ROLE_GRANT', 'ROLE_REVOKE', 'ACCOUNT_DEACTIVATE', 'AUDIT_REVIEW', 'BOOTSTRAP_OWNER');

-- CreateEnum
CREATE TYPE "AdminAuditTargetType" AS ENUM ('ADMIN_ACCOUNT', 'ADMIN_INVITATION', 'ADMIN_SESSION', 'ADMIN_PASSKEY_CREDENTIAL', 'ADMIN_ROLE_ASSIGNMENT', 'ADMIN_APPROVAL_REQUEST');

-- CreateEnum
CREATE TYPE "AdminAuditResult" AS ENUM ('SUCCEEDED', 'DENIED', 'FAILED');

-- DropForeignKey
ALTER TABLE "SeasonOperationAuditEvent" DROP CONSTRAINT "SeasonOperationAuditEvent_seasonId_fkey";

-- CreateTable
CREATE TABLE "AdminAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "failedAuthAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "lastLoginAt" TIMESTAMPTZ(3),
    "deactivatedAt" TIMESTAMPTZ(3),
    "anonymizedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminPasswordCredential" (
    "accountId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminPasswordCredential_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "AdminPasskeyCredential" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "deviceType" "AdminPasskeyDeviceType" NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "label" TEXT,
    "lastUsedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminPasskeyCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminTotpCredential" (
    "accountId" TEXT NOT NULL,
    "secretCiphertext" TEXT NOT NULL,
    "lastUsedTimeStep" BIGINT,
    "confirmedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminTotpCredential_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "AdminRecoveryCode" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminInvitation" (
    "id" TEXT NOT NULL,
    "kind" "AdminInvitationKind" NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "invitedByAccountId" TEXT,
    "acceptedAccountId" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scope" "AdminSessionScope" NOT NULL,
    "lastActivityAt" TIMESTAMPTZ(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "reauthenticatedAt" TIMESTAMPTZ(3),
    "revokedAt" TIMESTAMPTZ(3),
    "revocationReason" "AdminSessionRevocationReason",
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminWebAuthnChallenge" (
    "id" TEXT NOT NULL,
    "purpose" "AdminWebAuthnChallengePurpose" NOT NULL,
    "challenge" TEXT NOT NULL,
    "accountId" TEXT,
    "invitationId" TEXT,
    "sessionId" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminWebAuthnChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRoleAssignment" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedByApprovalRequestId" TEXT,
    "revokedAt" TIMESTAMPTZ(3),
    "revokedByApprovalRequestId" TEXT,

    CONSTRAINT "AdminRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminApprovalRequest" (
    "id" TEXT NOT NULL,
    "kind" "AdminApprovalRequestKind" NOT NULL,
    "status" "AdminApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "contentDigest" TEXT NOT NULL,
    "targetAccountId" TEXT,
    "targetRole" "AdminRole",
    "requestedByAccountId" TEXT NOT NULL,
    "requestReason" TEXT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "decidedByAccountId" TEXT,
    "closedAt" TIMESTAMPTZ(3),
    "decisionReason" TEXT,
    "selfApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditEvent" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorType" "AdminAuditActorType" NOT NULL,
    "actorAccountId" TEXT,
    "sessionId" TEXT,
    "accessPath" "AdminAuditAccessPath",
    "action" "AdminAuditAction" NOT NULL,
    "targetType" "AdminAuditTargetType",
    "targetId" TEXT,
    "approvalRequestId" TEXT,
    "result" "AdminAuditResult" NOT NULL,
    "selfApproved" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AdminAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminAccount_email_key" ON "AdminAccount"("email");

-- CreateIndex
CREATE INDEX "AdminAccount_status_deactivatedAt_idx" ON "AdminAccount"("status", "deactivatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminPasskeyCredential_credentialId_key" ON "AdminPasskeyCredential"("credentialId");

-- CreateIndex
CREATE INDEX "AdminPasskeyCredential_accountId_idx" ON "AdminPasskeyCredential"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRecoveryCode_codeHash_key" ON "AdminRecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "AdminRecoveryCode_accountId_idx" ON "AdminRecoveryCode"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminInvitation_codeHash_key" ON "AdminInvitation"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "AdminInvitation_acceptedAccountId_key" ON "AdminInvitation"("acceptedAccountId");

-- CreateIndex
CREATE INDEX "AdminInvitation_email_idx" ON "AdminInvitation"("email");

-- CreateIndex
CREATE INDEX "AdminInvitation_expiresAt_idx" ON "AdminInvitation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_accountId_revokedAt_idx" ON "AdminSession"("accountId", "revokedAt");

-- CreateIndex
CREATE INDEX "AdminSession_absoluteExpiresAt_idx" ON "AdminSession"("absoluteExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminWebAuthnChallenge_challenge_key" ON "AdminWebAuthnChallenge"("challenge");

-- CreateIndex
CREATE INDEX "AdminWebAuthnChallenge_expiresAt_idx" ON "AdminWebAuthnChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "AdminRoleAssignment_accountId_revokedAt_idx" ON "AdminRoleAssignment"("accountId", "revokedAt");

-- CreateIndex
CREATE INDEX "AdminRoleAssignment_revokedAt_idx" ON "AdminRoleAssignment"("revokedAt");

-- CreateIndex
CREATE INDEX "AdminApprovalRequest_status_expiresAt_idx" ON "AdminApprovalRequest"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminApprovalRequest_closedAt_idx" ON "AdminApprovalRequest"("closedAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_occurredAt_idx" ON "AdminAuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_actorAccountId_occurredAt_idx" ON "AdminAuditEvent"("actorAccountId", "occurredAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_targetType_targetId_occurredAt_idx" ON "AdminAuditEvent"("targetType", "targetId", "occurredAt");

-- CreateIndex
CREATE INDEX "AdminAuditEvent_approvalRequestId_idx" ON "AdminAuditEvent"("approvalRequestId");

-- AddForeignKey
ALTER TABLE "SeasonOperationAuditEvent" ADD CONSTRAINT "SeasonOperationAuditEvent_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AdminPasswordCredential" ADD CONSTRAINT "AdminPasswordCredential_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminPasskeyCredential" ADD CONSTRAINT "AdminPasskeyCredential_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTotpCredential" ADD CONSTRAINT "AdminTotpCredential_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRecoveryCode" ADD CONSTRAINT "AdminRecoveryCode_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_invitedByAccountId_fkey" FOREIGN KEY ("invitedByAccountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminInvitation" ADD CONSTRAINT "AdminInvitation_acceptedAccountId_fkey" FOREIGN KEY ("acceptedAccountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminWebAuthnChallenge" ADD CONSTRAINT "AdminWebAuthnChallenge_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminWebAuthnChallenge" ADD CONSTRAINT "AdminWebAuthnChallenge_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "AdminInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminWebAuthnChallenge" ADD CONSTRAINT "AdminWebAuthnChallenge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AdminSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRoleAssignment" ADD CONSTRAINT "AdminRoleAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRoleAssignment" ADD CONSTRAINT "AdminRoleAssignment_grantedByApprovalRequestId_fkey" FOREIGN KEY ("grantedByApprovalRequestId") REFERENCES "AdminApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRoleAssignment" ADD CONSTRAINT "AdminRoleAssignment_revokedByApprovalRequestId_fkey" FOREIGN KEY ("revokedByApprovalRequestId") REFERENCES "AdminApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminApprovalRequest" ADD CONSTRAINT "AdminApprovalRequest_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminApprovalRequest" ADD CONSTRAINT "AdminApprovalRequest_requestedByAccountId_fkey" FOREIGN KEY ("requestedByAccountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminApprovalRequest" ADD CONSTRAINT "AdminApprovalRequest_decidedByAccountId_fkey" FOREIGN KEY ("decidedByAccountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditEvent" ADD CONSTRAINT "AdminAuditEvent_actorAccountId_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AdminAuditEvent" ADD CONSTRAINT "AdminAuditEvent_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "AdminApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Manual constraints not represented by Prisma schema DSL
-- One active assignment per account and role: revocation then always ends the role.
CREATE UNIQUE INDEX "AdminRoleAssignment_accountId_role_active_key"
  ON "AdminRoleAssignment"("accountId", "role")
  WHERE "revokedAt" IS NULL;

-- Role requests name the account and the role they change.
ALTER TABLE "AdminApprovalRequest"
  ADD CONSTRAINT "AdminApprovalRequest_role_target_check"
  CHECK (
    "kind" NOT IN ('ROLE_GRANT', 'ROLE_REVOKE')
    OR ("targetAccountId" IS NOT NULL AND "targetRole" IS NOT NULL)
  );

-- A request leaves PENDING exactly when it is closed; the 3-year cleanup reads closedAt.
ALTER TABLE "AdminApprovalRequest"
  ADD CONSTRAINT "AdminApprovalRequest_closed_check"
  CHECK (("status" = 'PENDING') = ("closedAt" IS NULL));

-- A deactivated account has its deactivation time, and only a deactivated account is anonymized.
ALTER TABLE "AdminAccount"
  ADD CONSTRAINT "AdminAccount_deactivated_check"
  CHECK (("status" = 'DEACTIVATED') = ("deactivatedAt" IS NOT NULL));

ALTER TABLE "AdminAccount"
  ADD CONSTRAINT "AdminAccount_anonymized_check"
  CHECK ("anonymizedAt" IS NULL OR "status" = 'DEACTIVATED');

-- A revoked session records why; the 7-day cleanup reads revokedAt.
ALTER TABLE "AdminSession"
  ADD CONSTRAINT "AdminSession_revocation_pair_check"
  CHECK (("revokedAt" IS NULL) = ("revocationReason" IS NULL));

-- An admin actor is an account; system and anonymous actors have none.
ALTER TABLE "AdminAuditEvent"
  ADD CONSTRAINT "AdminAuditEvent_actor_check"
  CHECK (("actorType" = 'ADMIN') = ("actorAccountId" IS NOT NULL));
