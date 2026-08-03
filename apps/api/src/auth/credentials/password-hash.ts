import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import {
  runPasswordHashOperation,
  type AuthPasswordHashOperation,
} from './password-hash-admission.service.js';

export const AUTH_PASSWORD_HASH_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export const AUTH_LOGIN_CANONICAL_DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$MWixdBrCJzdfkLsFr93j5g$28iUudH+D3OHVyH1ygvinFZfjeIFtau/TfZA+K8zDIA';

export async function hashPassword(
  password: string,
  operation: AuthPasswordHashOperation = 'support',
): Promise<string> {
  return runPasswordHashOperation(operation, 'hash', () =>
    argonHash(password, AUTH_PASSWORD_HASH_OPTIONS),
  );
}

export async function verifyPasswordHash(
  hash: string,
  password: string,
  operation: AuthPasswordHashOperation = 'support',
): Promise<boolean> {
  return runPasswordHashOperation(operation, 'verify', () => argonVerify(hash, password));
}
