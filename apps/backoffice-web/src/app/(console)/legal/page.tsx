import { legalDocumentsOverviewResponseSchema } from '@repo/shared/backoffice';
import { LegalDocumentsScreen } from '@/screens/legal/LegalDocumentsScreen';
import { readBackoffice } from '@/server/backoffice-read';
import { hasPermission, requireFullSession } from '@/server/session';
import { Forbidden } from '@/ui/Forbidden';

export default async function LegalDocumentsPage() {
  const { session } = await requireFullSession();
  if (
    !hasPermission(session, 'admin:legal:edit') &&
    !hasPermission(session, 'admin:legal:approve')
  ) {
    return <Forbidden title="문서 판" />;
  }
  const overview = await readBackoffice('/legal/documents', legalDocumentsOverviewResponseSchema);
  if (overview.kind === 'forbidden') {
    return <Forbidden title="문서 판" />;
  }
  return <LegalDocumentsScreen overview={overview.data} />;
}
