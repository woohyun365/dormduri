import type { AccountListResponse } from '@repo/shared/backoffice';
import { shortId } from '@/ui/format';

/** An operator's name from the account list (owner role), or the short account id for everyone else (README §4). */
export function accountName(
  accounts: AccountListResponse['accounts'] | null,
  id: string | null,
): string {
  if (!id) return '—';
  const account = accounts?.find((candidate) => candidate.id === id);
  return account ? account.displayName : shortId(id);
}
