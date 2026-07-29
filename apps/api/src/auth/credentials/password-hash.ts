import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';

export const AUTH_PASSWORD_HASH_OPTIONS = {
  algorithm: 2,
  memoryCost: 8192,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export const AUTH_LOGIN_CANONICAL_DUMMY_HASH =
  '$argon2id$v=19$m=8192,t=2,p=1$QovAUCsTdKvsiJvCHh2T5g$vtmC3LkD3JNxK4pw9/1yXdMnRpifeqsJWkSBfitMKJ4';

export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, AUTH_PASSWORD_HASH_OPTIONS);
}

export async function verifyPasswordHash(hash: string, password: string): Promise<boolean> {
  return argonVerify(hash, password);
}
