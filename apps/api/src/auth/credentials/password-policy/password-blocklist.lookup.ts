import {
  AUTH_PASSWORD_BLOCKLIST_REFERENCE,
  validateAuthPasswordBlocklistReference,
} from './password-blocklist.reference.js';

validateAuthPasswordBlocklistReference();

const AUTH_PASSWORD_BLOCKLIST_LOOKUP = new Set<string>(AUTH_PASSWORD_BLOCKLIST_REFERENCE);

export function hasBlockedPasswordRiskKey(riskKey: string): boolean {
  return AUTH_PASSWORD_BLOCKLIST_LOOKUP.has(riskKey);
}

export function authPasswordBlocklistSize(): number {
  return AUTH_PASSWORD_BLOCKLIST_LOOKUP.size;
}
