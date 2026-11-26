import type { Metadata } from 'next';
import { LegalDocumentKind } from '@repo/shared/legal';
import { loadLegalDocumentPage } from '@/legal/api/legal-document.server';
import { LegalDocumentRouteView } from '@/legal/components/LegalDocumentRouteView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '개인정보 처리방침',
  description: '돔두리가 개인정보를 처리하고 보호하는 기준을 확인합니다.',
};

// `?version=YYYY-MM-DD` opens that version; the loader answers a malformed value as an unknown version.
export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ version?: string | string[] }>;
}) {
  const { version } = await searchParams;
  const result = await loadLegalDocumentPage(LegalDocumentKind.PRIVACY_POLICY, version);

  return <LegalDocumentRouteView result={result} currentDocumentHref="/privacy" />;
}
