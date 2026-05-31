import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';

const AUTH_PASSWORD_HASH_OPTIONS = {
  algorithm: 2,
  memoryCost: 8192,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return argonHash(password, AUTH_PASSWORD_HASH_OPTIONS);
}

export async function verifyPasswordHash(hash: string, password: string): Promise<boolean> {
  return argonVerify(hash, password);
}
