import {
  SecretReadError,
  type SecretReadOptions,
  type SecretReaderPort,
  readRequiredSecretsWith,
} from '../secret-reader.port.js';

export class EnvSecretReader implements SecretReaderPort {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  readSecret(name: string, _options: SecretReadOptions = {}): Promise<string> {
    const value = this.env[name]?.trim();
    if (!value) {
      return Promise.reject(
        new SecretReadError({ source: 'env', secretName: name, code: 'MISSING' }),
      );
    }

    return Promise.resolve(value);
  }

  async readRequiredSecrets(
    names: readonly string[],
    options: SecretReadOptions = {},
  ): Promise<Record<string, string>> {
    return readRequiredSecretsWith(this, names, options);
  }
}
