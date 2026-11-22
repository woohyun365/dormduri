import { hash, verify } from '@node-rs/argon2';

// argon2id (`algorithm: 2`; the library's enum is a const enum that isolated modules cannot read)
// with the OWASP minimum profile (19 MiB, 2 passes, 1 lane), the same library and profile as the
// user API.
const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

export class PasswordHasher {
  private dummyHash: Promise<string> | null = null;

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /**
   * Runs one verification against a fixed hash so an unknown or locked account answers in about
   * the same time as a wrong password (OA-R5 enumeration).
   */
  async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= hash('dormduri-backoffice-dummy-password', ARGON2_OPTIONS);
    await this.verify(await this.dummyHash, password);
  }
}
