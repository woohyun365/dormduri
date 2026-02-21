import { LegalPage } from '@/components/LegalPage';
import { TERMS_CONTENT } from '@/constants/legal';

export default function PrivacyPage() {
  return <LegalPage title={TERMS_CONTENT.privacy.title} content={TERMS_CONTENT.privacy.content} />;
}
