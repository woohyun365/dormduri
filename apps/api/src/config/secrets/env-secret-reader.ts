import {
  SecretReadError,
  type SecretReaderPort,
  readRequiredSecretsWith,
} from './secret-reader.port.js';

export class EnvSecretReader implements SecretReaderPort {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  readSecret(name: string): Promise<string> {
    const value = this.env[name]?.trim();
    if (!value) {
      return Promise.reject(
        new SecretReadError({ source: 'env', secretName: name, code: 'MISSING' }),
      );
    }

    return Promise.resolve(value);
  }

  async readRequiredSecrets(names: readonly string[]): Promise<Record<string, string>> {
    return readRequiredSecretsWith(this, names);
  }
}
