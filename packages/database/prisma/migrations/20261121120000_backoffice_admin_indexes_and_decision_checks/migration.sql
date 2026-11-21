-- CreateIndex
CREATE INDEX "AdminRoleAssignment_grantedByApprovalRequestId_idx" ON "AdminRoleAssignment"("grantedByApprovalRequestId");

-- CreateIndex
CREATE INDEX "AdminRoleAssignment_revokedByApprovalRequestId_idx" ON "AdminRoleAssignment"("revokedByApprovalRequestId");

-- CreateIndex
CREATE INDEX "AdminWebAuthnChallenge_invitationId_idx" ON "AdminWebAuthnChallenge"("invitationId");

-- CreateIndex
CREATE INDEX "AdminWebAuthnChallenge_sessionId_idx" ON "AdminWebAuthnChallenge"("sessionId");

-- Manual constraints not represented by Prisma schema DSL
-- A decided request names its decider; pending, cancelled and expired requests have none.
ALTER TABLE "AdminApprovalRequest"
  ADD CONSTRAINT "AdminApprovalRequest_decider_check"
  CHECK (("status" IN ('APPROVED', 'REJECTED')) = ("decidedByAccountId" IS NOT NULL));

-- The self-approval flag marks exactly an approval the requester decided (operator-access.md OA-R9).
ALTER TABLE "AdminApprovalRequest"
  ADD CONSTRAINT "AdminApprovalRequest_self_approval_check"
  CHECK (
    "selfApproved" = COALESCE(
      "status" = 'APPROVED' AND "decidedByAccountId" = "requestedByAccountId",
      false
    )
  );

-- A requester withdraws an own request by cancelling it; only another account rejects it.
ALTER TABLE "AdminApprovalRequest"
  ADD CONSTRAINT "AdminApprovalRequest_reject_by_other_check"
  CHECK ("status" <> 'REJECTED' OR "decidedByAccountId" <> "requestedByAccountId");
