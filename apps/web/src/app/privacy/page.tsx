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
  title: '개인정보 처리방침',
  description: '돔두리가 개인정보를 처리하고 보호하는 기준을 확인합니다.',
};

const kind = LegalDocumentKind.PRIVACY_POLICY;

// `?version=YYYY-MM-DD` opens that version; the loader answers a malformed value as an unknown version.
// A version address with no such version answers 404 before anything is sent, and not-found.tsx draws
// the page (D-LU18). With no document to show, the unavailable page; the source mark on a shown
// document is the Web deploy smoke's (infra/deploy/user/ssm/deploy.sh), drawn by the screen.
export default async function PrivacyPage({
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

  const comparison = await loadLegalVersionComparison(kind, result.data.viewing.versionKey);
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
