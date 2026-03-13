import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { TERMS_CONTENT } from '@/constants/legal';

export const metadata: Metadata = {
  title: '이용약관 | KNU 룸메',
  description: '강원대학교 학생 대상 독립 운영 룸메이트 매칭 서비스 이용약관',
};

export default function TermsPage() {
  return (
    <LegalPage
      title={TERMS_CONTENT.terms.title}
      content={TERMS_CONTENT.terms.content}
      effectiveDate={TERMS_CONTENT.terms.effectiveDate}
      lastModified={TERMS_CONTENT.terms.lastModified}
    />
  );
}
