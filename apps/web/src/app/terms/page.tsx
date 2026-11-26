import type { Metadata } from 'next';
import { LegalDocumentKind } from '@repo/shared/legal';
import { loadLegalDocumentPage } from '@/legal/api/legal-document.server';
import { LegalDocumentRouteView } from '@/legal/components/LegalDocumentRouteView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '이용약관',
  description: '돔두리 이용 조건과 서비스 운영 기준을 확인합니다.',
};

// `?version=YYYY-MM-DD` opens that version; the loader answers a malformed value as an unknown version.
export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ version?: string | string[] }>;
}) {
  const { version } = await searchParams;
  const result = await loadLegalDocumentPage(LegalDocumentKind.TERMS_OF_SERVICE, version);

  return <LegalDocumentRouteView result={result} currentDocumentHref="/terms" />;
}
