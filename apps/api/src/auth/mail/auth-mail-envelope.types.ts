import type { AuthMailKind } from '../../generated/prisma/enums.js';

export type VerificationAuthMailEnvelope = {
  schemaVersion: 1;
  mailKind: 'SIGNUP_VERIFICATION' | 'PASSWORD_RESET_VERIFICATION';
  email: string;
  code: string;
  expiresInSeconds: number;
};

export type PasswordChangedAuthMailEnvelope = {
  schemaVersion: 1;
  mailKind: 'PASSWORD_CHANGED';
  email: string;
};

export type AuthMailEnvelope = VerificationAuthMailEnvelope | PasswordChangedAuthMailEnvelope;

export type EncryptedAuthMailEnvelope = {
  payloadCiphertext: Buffer;
  payloadIv: Buffer;
  payloadAuthTag: Buffer;
  keyVersion: string;
};

export function isVerificationAuthMailKind(
  mailKind: AuthMailKind,
): mailKind is 'SIGNUP_VERIFICATION' | 'PASSWORD_RESET_VERIFICATION' {
  return mailKind === 'SIGNUP_VERIFICATION' || mailKind === 'PASSWORD_RESET_VERIFICATION';
}
