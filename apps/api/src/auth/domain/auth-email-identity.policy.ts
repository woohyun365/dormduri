import { KNU_EMAIL_DOMAIN, normalizeEmail as normalizeEmailShared } from '@repo/shared/auth/policy';

export function normalizeAuthEmail(email: string): string {
  return normalizeEmailShared(email);
}

export function isKnuAuthEmail(email: string): boolean {
  return normalizeAuthEmail(email).endsWith(KNU_EMAIL_DOMAIN);
}
