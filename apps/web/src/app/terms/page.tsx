import { LegalPage } from '@/components/LegalPage';
import { TERMS_CONTENT } from '@/constants/legal';

export default function TermsPage() {
  return <LegalPage title={TERMS_CONTENT.terms.title} content={TERMS_CONTENT.terms.content} />;
}
