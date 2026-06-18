import {
  GetSecretValueCommand,
  SecretsManagerClient,
  type GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager';
import {
  SecretReadError,
  type SecretReadErrorCode,
  type SecretReaderPort,
  readRequiredSecretsWith,
} from './secret-reader.port.js';

export interface SecretsManagerClientLike {
  send(command: GetSecretValueCommand): Promise<GetSecretValueCommandOutput>;
}

export interface AwsSecretsManagerSecretReaderOptions {
  readonly client?: SecretsManagerClientLike;
  readonly region?: string;
}

export class AwsSecretsManagerSecretReader implements SecretReaderPort {
  private readonly client: SecretsManagerClientLike;

  constructor(options: AwsSecretsManagerSecretReaderOptions = {}) {
    this.client =
      options.client ??
      new SecretsManagerClient(options.region === undefined ? {} : { region: options.region });
  }

  async readSecret(name: string): Promise<string> {
    try {
      const result = await this.client.send(new GetSecretValueCommand({ SecretId: name }));
      if (typeof result.SecretString === 'string' && result.SecretString.trim().length > 0) {
        return result.SecretString;
      }

      if (result.SecretBinary !== undefined) {
        throw new SecretReadError({
          source: 'aws-secrets-manager',
          secretName: name,
          code: 'UNSUPPORTED_BINARY',
        });
      }

      throw new SecretReadError({
        source: 'aws-secrets-manager',
        secretName: name,
        code: 'MISSING',
      });
    } catch (error) {
      if (error instanceof SecretReadError) {
        throw error;
      }

      throw new SecretReadError({
        source: 'aws-secrets-manager',
        secretName: name,
        code: mapAwsSecretsManagerErrorCode(error),
        cause: error,
      });
    }
  }

  async readRequiredSecrets(names: readonly string[]): Promise<Record<string, string>> {
    return readRequiredSecretsWith(this, names);
  }
}

export function mapAwsSecretsManagerErrorCode(error: unknown): SecretReadErrorCode {
  const errorName = getAwsErrorName(error);

  switch (errorName) {
    case 'ResourceNotFoundException':
      return 'MISSING';
    case 'AccessDeniedException':
    case 'UnrecognizedClientException':
    case 'InvalidSignatureException':
      return 'ACCESS_DENIED';
    case 'DecryptionFailure':
    case 'DecryptionFailureException':
      return 'DECRYPTION_FAILURE';
    case 'ThrottlingException':
    case 'TooManyRequestsException':
      return 'THROTTLED';
    case 'InternalServiceError':
    case 'InternalServiceErrorException':
    case 'ServiceUnavailableException':
    case 'TimeoutError':
      return 'TRANSIENT';
    default:
      return 'UNKNOWN';
  }
}

function getAwsErrorName(error: unknown): string | undefined {
  if (error !== null && typeof error === 'object' && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    return typeof name === 'string' ? name : undefined;
  }

  return undefined;
}
