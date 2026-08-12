export type SecretReaderSource = 'env' | 'aws-secrets-manager';

export type SecretReadErrorCode =
  | 'MISSING'
  | 'ACCESS_DENIED'
  | 'DECRYPTION_FAILURE'
  | 'THROTTLED'
  | 'TRANSIENT'
  | 'UNSUPPORTED_BINARY'
  | 'UNKNOWN';

export interface SecretReadErrorOptions {
  readonly source: SecretReaderSource;
  readonly secretName: string;
  readonly code: SecretReadErrorCode;
  readonly cause?: unknown;
}

export class SecretReadError extends Error {
  readonly source: SecretReaderSource;
  readonly secretName: string;
  readonly code: SecretReadErrorCode;
  override readonly cause?: unknown;

  constructor(options: SecretReadErrorOptions) {
    super(
      `[config:secrets] ${options.source} secret "${options.secretName}" failed: ${options.code}.`,
      {
        cause: options.cause,
      },
    );
    this.name = 'SecretReadError';
    this.source = options.source;
    this.secretName = options.secretName;
    this.code = options.code;
    this.cause = options.cause;
  }
}

export interface SecretReaderPort {
  readSecret(name: string, options?: SecretReadOptions): Promise<string>;
  readRequiredSecrets(
    names: readonly string[],
    options?: SecretReadOptions,
  ): Promise<Record<string, string>>;
}

export interface SecretReadOptions {
  readonly signal?: AbortSignal;
}

export async function readRequiredSecretsWith(
  reader: Pick<SecretReaderPort, 'readSecret'>,
  names: readonly string[],
  options: SecretReadOptions = {},
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    names.map(async (name) => [name, await reader.readSecret(name, options)]),
  );
  return Object.fromEntries(entries) as Record<string, string>;
}
