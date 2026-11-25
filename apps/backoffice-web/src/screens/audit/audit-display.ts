import type { AuditEvent } from '@repo/shared/backoffice';

export type RecoveryLoginMethod = 'totp' | 'recovery_code';

/**
 * The second factor of a recovery login, read from a LOGIN row's metadata. The API writes `{ scope, method }` when a
 * login opens a session (admin-login.service.ts); the shared schema keeps metadata `unknown`, so only that shape counts
 * and anything else is shown as a plain login.
 */
export function recoveryLoginMethod(event: AuditEvent): RecoveryLoginMethod | null {
  if (event.action !== 'LOGIN') return null;
  const metadata = event.metadata;
  if (typeof metadata !== 'object' || metadata === null) return null;
  const { scope, method } = metadata as { readonly scope?: unknown; readonly method?: unknown };
  if (scope !== 'RECOVERY') return null;
  return method === 'totp' || method === 'recovery_code' ? method : null;
}
