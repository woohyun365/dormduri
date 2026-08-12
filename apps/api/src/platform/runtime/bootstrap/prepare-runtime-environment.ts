import {
  applyMaterializedSecretsToEnv,
  materializeRequiredSecrets,
} from '../../../config/secrets/secret-materializer.js';
import { normalizeSecretNamePrefix } from '../../../config/secrets/secret-name-registry.js';
import type { SecretReaderPort } from '../../../config/secrets/secret-reader.port.js';
import { DEFAULT_NODE_ENV } from '../app.config.js';
import {
  readSecretNamePrefix,
  readSecretSource,
  type SecretSource,
} from '../secret-source.config.js';
import {
  clearRuntimeBootstrapReceipt,
  createRuntimeBootstrapReceipt,
  recordRuntimeBootstrapReceipt,
  type RuntimeBootstrapReceipt,
} from './runtime-bootstrap-receipt.js';

export const DEFAULT_SECRET_MATERIALIZATION_TIMEOUT_MS = 10_000;

export type RuntimeEnvironmentPreparationErrorCode =
  | 'BOOTSTRAP_ENV_INVALID'
  | 'SECRET_MATERIALIZATION_TIMEOUT'
  | 'SECRET_MATERIALIZATION_FAILED';

export class RuntimeEnvironmentPreparationError extends Error {
  readonly code: RuntimeEnvironmentPreparationErrorCode;
  override readonly cause?: unknown;

  constructor(code: RuntimeEnvironmentPreparationErrorCode, cause?: unknown) {
    super(runtimeEnvironmentPreparationErrorMessage(code), { cause });
    this.name = 'RuntimeEnvironmentPreparationError';
    this.code = code;
    this.cause = cause;
  }
}

export interface RuntimeBootstrapEnvironment {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly secretSource: SecretSource;
  readonly secretNamePrefix: string | null;
}

export interface PrepareRuntimeEnvironmentOptions {
  readonly reader?: SecretReaderPort;
  readonly timeoutMs?: number;
  readonly now?: () => Date;
}

export async function prepareRuntimeEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  options: PrepareRuntimeEnvironmentOptions = {},
): Promise<RuntimeBootstrapReceipt> {
  clearRuntimeBootstrapReceipt();
  const bootstrapEnvironment = parseRuntimeBootstrapEnvironment(env);
  const timeoutMs = options.timeoutMs ?? DEFAULT_SECRET_MATERIALIZATION_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new RangeError('Runtime environment preparation timeout must be a positive integer.');
  }

  const abortController = new AbortController();
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    const materializedSecrets = await Promise.race([
      materializeRequiredSecrets({
        env,
        nodeEnv: bootstrapEnvironment.nodeEnv,
        source: bootstrapEnvironment.secretSource,
        secretNamePrefix: bootstrapEnvironment.secretNamePrefix,
        reader: options.reader,
        signal: abortController.signal,
      }),
      new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          abortController.abort();
          reject(new RuntimeEnvironmentPreparationError('SECRET_MATERIALIZATION_TIMEOUT'));
        }, timeoutMs);
      }),
    ]);

    applyMaterializedSecretsToEnv(env, materializedSecrets);
    const receipt = createRuntimeBootstrapReceipt({
      secretSource: bootstrapEnvironment.secretSource,
      materializedSecretCount: Object.keys(materializedSecrets).length,
      completedAt: (options.now ?? (() => new Date()))(),
    });
    recordRuntimeBootstrapReceipt(receipt);
    return receipt;
  } catch (error) {
    if (error instanceof RuntimeEnvironmentPreparationError) {
      throw error;
    }
    throw new RuntimeEnvironmentPreparationError('SECRET_MATERIALIZATION_FAILED', error);
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

export function parseRuntimeBootstrapEnvironment(
  env: NodeJS.ProcessEnv,
): RuntimeBootstrapEnvironment {
  try {
    const nodeEnv = parseNodeEnv(env.NODE_ENV);
    const secretSource = readSecretSource(env);
    const configuredPrefix = readSecretNamePrefix(env);
    const secretNamePrefix =
      configuredPrefix === null ? null : normalizeSecretNamePrefix(configuredPrefix);

    if (nodeEnv === 'production' && secretSource === 'aws-secrets-manager' && !secretNamePrefix) {
      throw new Error('Production Secrets Manager source requires a name prefix.');
    }

    return { nodeEnv, secretSource, secretNamePrefix };
  } catch (error) {
    throw new RuntimeEnvironmentPreparationError('BOOTSTRAP_ENV_INVALID', error);
  }
}

export function describeRuntimeEnvironmentPreparationFailure(error: unknown): {
  readonly code: RuntimeEnvironmentPreparationErrorCode | 'RUNTIME_PREPARATION_UNKNOWN';
  readonly message: string;
} {
  if (error instanceof RuntimeEnvironmentPreparationError) {
    return { code: error.code, message: error.message };
  }

  return {
    code: 'RUNTIME_PREPARATION_UNKNOWN',
    message: 'API runtime environment preparation failed.',
  };
}

function parseNodeEnv(value: string | undefined): RuntimeBootstrapEnvironment['nodeEnv'] {
  const nodeEnv = value?.trim() || DEFAULT_NODE_ENV;
  if (nodeEnv === 'development' || nodeEnv === 'test' || nodeEnv === 'production') {
    return nodeEnv;
  }
  throw new Error('NODE_ENV is unsupported.');
}

function runtimeEnvironmentPreparationErrorMessage(
  code: RuntimeEnvironmentPreparationErrorCode,
): string {
  switch (code) {
    case 'BOOTSTRAP_ENV_INVALID':
      return 'API bootstrap environment is invalid.';
    case 'SECRET_MATERIALIZATION_TIMEOUT':
      return 'API secret materialization timed out.';
    case 'SECRET_MATERIALIZATION_FAILED':
      return 'API secret materialization failed.';
  }
}
