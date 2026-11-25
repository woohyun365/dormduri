import { notFound } from 'next/navigation';
import {
  legalBackofficeVersionDetailSchema,
  legalDocumentsOverviewResponseSchema,
} from '@repo/shared/backoffice';
import { LegalVersionScreen } from '@/screens/legal/LegalVersionScreen';
import { readBackoffice } from '@/server/backoffice-read';
import { isLegalVersionId } from '@/server/page-query';
import { hasPermission, requireFullSession } from '@/server/session';
import { Forbidden } from '@/ui/Forbidden';

export default async function LegalVersionPage({
  params,
}: {
  readonly params: Promise<{ versionId: string }>;
}) {
  const { session } = await requireFullSession();
  if (
    !hasPermission(session, 'admin:legal:edit') &&
    !hasPermission(session, 'admin:legal:approve')
  ) {
    return <Forbidden title="문서 판" />;
  }
  const { versionId } = await params;
  if (!isLegalVersionId(versionId)) notFound();
  // The detail has no state; the overview says it as of the database clock.
  const [version, overview] = await Promise.all([
    readBackoffice(`/legal/versions/${versionId}`, legalBackofficeVersionDetailSchema),
    readBackoffice('/legal/documents', legalDocumentsOverviewResponseSchema),
  ]);
  if (version.kind === 'forbidden' || overview.kind === 'forbidden') {
    return <Forbidden title="문서 판" />;
  }
  const state =
    overview.data.documents
      .flatMap((document) => document.versions)
      .find((candidate) => candidate.id === versionId)?.state ?? null;
  return (
    <LegalVersionScreen
      version={version.data}
      state={state}
      canEdit={hasPermission(session, 'admin:legal:edit')}
    />
  );
}
