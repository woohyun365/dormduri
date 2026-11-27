import { LegalDocumentKind } from '@repo/shared/legal';
import { LegalVersionNotFoundScreen } from '@/screens/legal';

// A version address (/privacy?version=…) whose version does not exist: page.tsx calls notFound() before
// any response is sent, so the answer is 404 with noindex and this file draws the page (D-LU18).
export default function PrivacyVersionNotFound() {
  return <LegalVersionNotFoundScreen kind={LegalDocumentKind.PRIVACY_POLICY} />;
}
