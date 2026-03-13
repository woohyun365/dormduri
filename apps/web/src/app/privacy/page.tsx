import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { TERMS_CONTENT } from '@/constants/legal';

export const metadata: Metadata = {
  title: '개인정보 처리방침 | KNU 룸메',
  description: '강원대학교 학생 대상 독립 운영 룸메이트 매칭 서비스 개인정보 처리방침',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title={TERMS_CONTENT.privacy.title}
      content={TERMS_CONTENT.privacy.content}
      effectiveDate={TERMS_CONTENT.privacy.effectiveDate}
      lastModified={TERMS_CONTENT.privacy.lastModified}
    />
  );
}
