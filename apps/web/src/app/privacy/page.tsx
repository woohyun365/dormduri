import type { Metadata } from 'next';
import { LegalDocumentKind } from '@repo/shared/legal';
import { LegalDocumentLayout } from '@/legal/components/LegalDocumentLayout';
import { LegalDocumentUnavailable } from '@/legal/components/LegalDocumentUnavailable';
import { getLegalDocumentPageData } from '@/legal/api/legal-document.server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '개인정보 처리방침',
  description: '돔두리가 개인정보를 처리하고 보호하는 기준을 확인합니다.',
};

export default async function PrivacyPage() {
  const result = await getLegalDocumentPageData(LegalDocumentKind.PRIVACY_POLICY);

  if (result.status === 'unavailable') {
    return <LegalDocumentUnavailable />;
  }

  return <LegalDocumentLayout document={result.document} source={result.source} />;
}
