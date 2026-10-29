import type { Metadata } from 'next';
import { LegalDocumentKind } from '@repo/shared/legal';
import { LegalDocumentLayout } from '@/legal/components/LegalDocumentLayout';
import { LegalDocumentUnavailable } from '@/legal/components/LegalDocumentUnavailable';
import { getLegalDocumentPageData } from '@/legal/api/legal-document.server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '이용약관',
  description: '돔두리 이용 조건과 서비스 운영 기준을 확인합니다.',
};

export default async function TermsPage() {
  const result = await getLegalDocumentPageData(LegalDocumentKind.TERMS_OF_SERVICE);

  if (result.status === 'unavailable') {
    return <LegalDocumentUnavailable />;
  }

  return <LegalDocumentLayout document={result.document} source={result.source} />;
}
