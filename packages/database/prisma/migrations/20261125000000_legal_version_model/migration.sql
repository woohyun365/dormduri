-- Legal version model: content-immutable published versions keyed by their KST effective date, backoffice
-- drafts, the legal approval kinds and audit targets the backoffice legal module uses, reconsent records and
-- the member count the significant-change check reads. Plan: legal-content-operations D-LC1~D-LC3, D-LC7, D-LC8.

-- CreateEnum
CREATE TYPE "LegalNoticeClass" AS ENUM ('HISTORICAL', 'INITIAL', 'GENERAL', 'SIGNIFICANT');

-- CreateEnum
CREATE TYPE "LegalDocumentDraftStatus" AS ENUM ('EDITING', 'PENDING_APPROVAL', 'PUBLISHED', 'DISCARDED');

-- AlterEnum
-- New values cannot be used as enum literals in the transaction that adds them, so the CHECKs below
-- compare `kind::text`.
ALTER TYPE "AdminApprovalRequestKind" ADD VALUE 'LEGAL_PUBLISH';
ALTER TYPE "AdminApprovalRequestKind" ADD VALUE 'LEGAL_WITHDRAW';

-- AlterEnum
ALTER TYPE "AdminAuditAction" ADD VALUE 'LEGAL_DRAFT_CREATE';
ALTER TYPE "AdminAuditAction" ADD VALUE 'LEGAL_DRAFT_UPDATE';
ALTER TYPE "AdminAuditAction" ADD VALUE 'LEGAL_DRAFT_DISCARD';
ALTER TYPE "AdminAuditAction" ADD VALUE 'LEGAL_PUBLISH_REQUEST';
ALTER TYPE "AdminAuditAction" ADD VALUE 'LEGAL_PUBLISH_APPROVE';
ALTER TYPE "AdminAuditAction" ADD VALUE 'LEGAL_PUBLISH_REJECT';
ALTER TYPE "AdminAuditAction" ADD VALUE 'LEGAL_WITHDRAW_REQUEST';
ALTER TYPE "AdminAuditAction" ADD VALUE 'LEGAL_WITHDRAW_APPROVE';
ALTER TYPE "AdminAuditAction" ADD VALUE 'LEGAL_WITHDRAW_REJECT';
ALTER TYPE "AdminAuditAction" ADD VALUE 'LEGAL_REQUEST_CANCEL';

-- AlterEnum
ALTER TYPE "AdminAuditTargetType" ADD VALUE 'LEGAL_DOCUMENT_DRAFT';
ALTER TYPE "AdminAuditTargetType" ADD VALUE 'LEGAL_DOCUMENT_VERSION';

-- DropIndex
DROP INDEX "LegalDocumentVersion_kind_effectiveAt_id_idx";

-- DropIndex
DROP INDEX "LegalDocumentVersion_kind_publishedAt_effectiveAt_retiredAt_idx";

-- AlterTable
ALTER TABLE "AdminApprovalRequest" ADD COLUMN     "targetLegalDraftId" TEXT,
ADD COLUMN     "targetLegalVersionId" TEXT;

-- AlterTable: the retirement time becomes the withdrawal time (only a scheduled version is withdrawn).
ALTER TABLE "LegalDocumentVersion" RENAME COLUMN "retiredAt" TO "withdrawnAt";

-- AlterTable
ALTER TABLE "LegalDocumentVersion" ADD COLUMN     "appliesUntil" DATE,
ADD COLUMN     "approverAdminAccountId" TEXT,
ADD COLUMN     "authorAdminAccountId" TEXT,
ADD COLUMN     "consentRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contentDigest" TEXT,
ADD COLUMN     "effectiveDate" DATE,
ADD COLUMN     "noticeClass" "LegalNoticeClass",
ADD COLUMN     "selfApproved" BOOLEAN NOT NULL DEFAULT false;

-- Existing rows are repository seed versions in development and test databases (production has none).
-- Each keeps its effective time as its KST date and the earliest version of a kind becomes the first
-- publication. The digest here is the sha256 of PostgreSQL's jsonb text of the same fields, not the
-- shared calculation; running the seed again replaces it.
UPDATE "LegalDocumentVersion" AS target
SET
  "effectiveDate" = ("effectiveAt" AT TIME ZONE 'Asia/Seoul')::date,
  "noticeClass" = CASE
    WHEN ranked."position" = 1 THEN 'INITIAL'::"LegalNoticeClass"
    ELSE 'GENERAL'::"LegalNoticeClass"
  END,
  "changeSummary" = COALESCE(NULLIF(btrim(target."changeSummary"), ''), target."title"),
  "publishedAt" = COALESCE(target."publishedAt", "effectiveAt")
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "kind" ORDER BY "effectiveAt", "id") AS "position"
  FROM "LegalDocumentVersion"
) AS ranked
WHERE ranked."id" = target."id";

UPDATE "LegalDocumentVersion"
SET "contentDigest" = encode(
  sha256(
    convert_to(
      jsonb_build_array(
        "kind", "title", "summaryItems", "sections", "changeSummary", "effectiveDate", NULL,
        "noticeClass", "consentRequired"
      )::text,
      'UTF8'
    )
  ),
  'hex'
);

-- AlterTable
ALTER TABLE "LegalDocumentVersion" DROP COLUMN "effectiveAt",
ALTER COLUMN "contentDigest" SET NOT NULL,
ALTER COLUMN "effectiveDate" SET NOT NULL,
ALTER COLUMN "noticeClass" SET NOT NULL,
ALTER COLUMN "changeSummary" SET NOT NULL,
ALTER COLUMN "publishedAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "LegalDocumentDraft" (
    "id" TEXT NOT NULL,
    "kind" "LegalDocumentKind" NOT NULL,
    "basedOnVersionId" TEXT,
    "title" TEXT NOT NULL,
    "summaryItems" JSONB NOT NULL,
    "sections" JSONB NOT NULL,
    "changeSummary" TEXT NOT NULL,
    "noticeClass" "LegalNoticeClass" NOT NULL,
    "consentRequired" BOOLEAN NOT NULL DEFAULT false,
    "proposedEffectiveDate" DATE NOT NULL,
    "appliesUntil" DATE,
    "status" "LegalDocumentDraftStatus" NOT NULL DEFAULT 'EDITING',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "authorAdminAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocumentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalDocumentDraft_kind_status_idx" ON "LegalDocumentDraft"("kind", "status");

-- CreateIndex
CREATE INDEX "LegalDocumentDraft_basedOnVersionId_idx" ON "LegalDocumentDraft"("basedOnVersionId");

-- CreateIndex
CREATE INDEX "LegalDocumentDraft_authorAdminAccountId_idx" ON "LegalDocumentDraft"("authorAdminAccountId");

-- CreateIndex
CREATE INDEX "AdminApprovalRequest_targetLegalDraftId_idx" ON "AdminApprovalRequest"("targetLegalDraftId");

-- CreateIndex
CREATE INDEX "AdminApprovalRequest_targetLegalVersionId_idx" ON "AdminApprovalRequest"("targetLegalVersionId");

-- CreateIndex
CREATE INDEX "LegalDocumentVersion_kind_effectiveDate_idx" ON "LegalDocumentVersion"("kind", "effectiveDate");

-- CreateIndex
CREATE INDEX "LegalDocumentVersion_authorAdminAccountId_idx" ON "LegalDocumentVersion"("authorAdminAccountId");

-- CreateIndex
CREATE INDEX "LegalDocumentVersion_approverAdminAccountId_idx" ON "LegalDocumentVersion"("approverAdminAccountId");

-- AddForeignKey
ALTER TABLE "LegalDocumentVersion" ADD CONSTRAINT "LegalDocumentVersion_authorAdminAccountId_fkey" FOREIGN KEY ("authorAdminAccountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LegalDocumentVersion" ADD CONSTRAINT "LegalDocumentVersion_approverAdminAccountId_fkey" FOREIGN KEY ("approverAdminAccountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LegalDocumentDraft" ADD CONSTRAINT "LegalDocumentDraft_basedOnVersionId_fkey" FOREIGN KEY ("basedOnVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "LegalDocumentDraft" ADD CONSTRAINT "LegalDocumentDraft_authorAdminAccountId_fkey" FOREIGN KEY ("authorAdminAccountId") REFERENCES "AdminAccount"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AdminApprovalRequest" ADD CONSTRAINT "AdminApprovalRequest_targetLegalDraftId_fkey" FOREIGN KEY ("targetLegalDraftId") REFERENCES "LegalDocumentDraft"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AdminApprovalRequest" ADD CONSTRAINT "AdminApprovalRequest_targetLegalVersionId_fkey" FOREIGN KEY ("targetLegalVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Manual constraints not represented by Prisma schema DSL
-- Versions that are not withdrawn never share a public key (kind, effective date).
CREATE UNIQUE INDEX "LegalDocumentVersion_kind_effectiveDate_active_key"
  ON "LegalDocumentVersion"("kind", "effectiveDate")
  WHERE "withdrawnAt" IS NULL;

-- A kind is published for the first time once.
CREATE UNIQUE INDEX "LegalDocumentVersion_kind_initial_key"
  ON "LegalDocumentVersion"("kind")
  WHERE "noticeClass" = 'INITIAL';

-- Only a historical record has an applies-until date, and it does not end before it starts.
ALTER TABLE "LegalDocumentVersion"
  ADD CONSTRAINT "LegalDocumentVersion_applies_until_check"
  CHECK (
    ("noticeClass" = 'HISTORICAL') = ("appliesUntil" IS NOT NULL)
    AND ("appliesUntil" IS NULL OR "appliesUntil" >= "effectiveDate")
  );

-- Reconsent applies to a kind agreed to at signup, never to a historical record, and always to a
-- significant terms of service change (legal-basis LB-R11).
ALTER TABLE "LegalDocumentVersion"
  ADD CONSTRAINT "LegalDocumentVersion_consent_kind_check"
  CHECK (
    (
      NOT "consentRequired"
      OR (
        "kind" IN ('TERMS_OF_SERVICE', 'PERSONAL_DATA_COLLECTION_USE_CONSENT', 'AGE_14_OR_ABOVE_NOTICE')
        AND "noticeClass" <> 'HISTORICAL'
      )
    )
    AND ("kind" <> 'TERMS_OF_SERVICE' OR "noticeClass" <> 'SIGNIFICANT' OR "consentRequired")
  );

ALTER TABLE "LegalDocumentVersion"
  ADD CONSTRAINT "LegalDocumentVersion_content_digest_check"
  CHECK ("contentDigest" ~ '^[0-9a-f]{64}$');

ALTER TABLE "LegalDocumentVersion"
  ADD CONSTRAINT "LegalDocumentVersion_change_summary_check"
  CHECK (length(btrim("changeSummary")) > 0);

-- Only a version with a notice period can be withdrawn (before it takes effect).
ALTER TABLE "LegalDocumentVersion"
  ADD CONSTRAINT "LegalDocumentVersion_withdrawal_check"
  CHECK ("withdrawnAt" IS NULL OR "noticeClass" IN ('GENERAL', 'SIGNIFICANT'));

-- A backoffice-approved version names its author and approver; a repository seed version names neither.
ALTER TABLE "LegalDocumentVersion"
  ADD CONSTRAINT "LegalDocumentVersion_approval_pair_check"
  CHECK (("authorAdminAccountId" IS NULL) = ("approverAdminAccountId" IS NULL));

-- The self-approval flag marks exactly an approval by the author (operator-access.md OA-R9).
ALTER TABLE "LegalDocumentVersion"
  ADD CONSTRAINT "LegalDocumentVersion_self_approval_check"
  CHECK ("selfApproved" = COALESCE("approverAdminAccountId" = "authorAdminAccountId", false));

ALTER TABLE "LegalDocumentDraft"
  ADD CONSTRAINT "LegalDocumentDraft_applies_until_check"
  CHECK (
    ("noticeClass" = 'HISTORICAL') = ("appliesUntil" IS NOT NULL)
    AND ("appliesUntil" IS NULL OR "appliesUntil" >= "proposedEffectiveDate")
  );

ALTER TABLE "LegalDocumentDraft"
  ADD CONSTRAINT "LegalDocumentDraft_consent_kind_check"
  CHECK (
    (
      NOT "consentRequired"
      OR (
        "kind" IN ('TERMS_OF_SERVICE', 'PERSONAL_DATA_COLLECTION_USE_CONSENT', 'AGE_14_OR_ABOVE_NOTICE')
        AND "noticeClass" <> 'HISTORICAL'
      )
    )
    AND ("kind" <> 'TERMS_OF_SERVICE' OR "noticeClass" <> 'SIGNIFICANT' OR "consentRequired")
  );

ALTER TABLE "LegalDocumentDraft"
  ADD CONSTRAINT "LegalDocumentDraft_revision_check"
  CHECK ("revision" >= 1);

-- A legal publish request names its draft and a legal withdraw request names its scheduled version.
ALTER TABLE "AdminApprovalRequest"
  ADD CONSTRAINT "AdminApprovalRequest_legal_target_check"
  CHECK (
    ("kind"::text = 'LEGAL_PUBLISH') = ("targetLegalDraftId" IS NOT NULL)
    AND ("kind"::text = 'LEGAL_WITHDRAW') = ("targetLegalVersionId" IS NOT NULL)
  );

-- Acceptance records come from signup or from a reconsent.
ALTER TABLE "LegalAcceptanceRecord"
  ADD CONSTRAINT "LegalAcceptanceRecord_source_check"
  CHECK ("source" IN ('SIGNUP', 'RECONSENT'));

-- The one user-table read the backoffice has: how many members can still receive mail (not withdrawn).
-- The view runs with its owner's privileges, so backoffice_runtime reads this count and nothing in "User".
CREATE VIEW "LegalNoticeRecipientCount" AS
SELECT count(*)::integer AS "recipientCount"
FROM "User"
WHERE "deletedAt" IS NULL;
