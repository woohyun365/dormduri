import { randomInt } from 'node:crypto';
import { sha256Hex } from './tokens.js';

/** Ten one-time recovery codes, shown once at issue; only their hashes are stored (OA-R2). */
export const RECOVERY_CODE_COUNT = 10;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateRecoveryCode(): string {
  const characters = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]!);
  return `${characters.slice(0, 5).join('')}-${characters.slice(5).join('')}`;
}

export function generateRecoveryCodes(): string[] {
  const codes = new Set<string>();
  while (codes.size < RECOVERY_CODE_COUNT) {
    codes.add(generateRecoveryCode());
  }
  return [...codes];
}

export function normalizeRecoveryCode(code: string): string {
  return code.trim().toUpperCase();
}

export function hashRecoveryCode(code: string): string {
  return sha256Hex(`recovery:${normalizeRecoveryCode(code)}`);
}
