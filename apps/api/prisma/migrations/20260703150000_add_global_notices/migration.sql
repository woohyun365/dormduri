-- CreateTable
CREATE TABLE "GlobalNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "relatedSeasonId" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GlobalNotice_publishedAt_expiresAt_id_idx" ON "GlobalNotice"("publishedAt", "expiresAt", "id");

-- CreateIndex
CREATE INDEX "GlobalNotice_severity_publishedAt_id_idx" ON "GlobalNotice"("severity", "publishedAt", "id");

-- CreateIndex
CREATE INDEX "GlobalNotice_relatedSeasonId_publishedAt_id_idx" ON "GlobalNotice"("relatedSeasonId", "publishedAt", "id");
