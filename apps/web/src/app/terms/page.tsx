import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocumentKind } from '@repo/shared/legal';
import {
  loadLegalDocumentPage,
  loadLegalVersionComparison,
} from '@/legal/api/legal-document.server';
import { LegalDocumentScreen, LegalUnavailableScreen } from '@/screens/legal';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '이용약관',
  description: '돔두리 이용 조건과 서비스 운영 기준을 확인합니다.',
};

const kind = LegalDocumentKind.TERMS_OF_SERVICE;

// `?version=YYYY-MM-DD` opens that version; the loader answers a malformed value as an unknown version.
// A version address with no such version answers 404 before anything is sent, and not-found.tsx draws
// the page (D-LU18). With no document to show, the unavailable page; the source mark on a shown
// document is the Web deploy smoke's (infra/deploy/user/ssm/deploy.sh), drawn by the screen.
export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ version?: string | string[] }>;
}) {
  const { version } = await searchParams;
  const result = await loadLegalDocumentPage(kind, version);
  if (result.status === 'version-not-found' && version !== undefined) notFound();
  if (result.status !== 'published' && result.status !== 'last-success') {
    return <LegalUnavailableScreen kind={kind} />;
  }

  // A page from the kept copy means the API did not answer: the comparison comes from the kept copy
  // too, so the first response waits for the API once, not twice.
  const comparison = await loadLegalVersionComparison(
    kind,
    result.data.viewing.versionKey,
    ...(result.status === 'last-success' ? [{ lastSuccess: 'only' as const }] : []),
  );
  return (
    <LegalDocumentScreen
      page={result.data}
      source={
        result.status === 'published'
          ? { kind: 'published' }
          : { kind: 'last-success', checkedAt: result.checkedAt }
      }
      comparison={
        comparison.status === 'published' || comparison.status === 'last-success'
          ? comparison.data
          : null
      }
    />
  );
}
