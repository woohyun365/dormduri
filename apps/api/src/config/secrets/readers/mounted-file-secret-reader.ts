import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import {
  SecretReadError,
  type SecretReadErrorCode,
  type SecretReadOptions,
  type SecretReaderPort,
  readRequiredSecretsWith,
} from '../secret-reader.port.js';

export const DEFAULT_MOUNTED_SECRET_MAX_BYTES = 64 * 1024;
const SECRET_FILE_NAME = /^[A-Z][A-Z0-9_]*$/u;

export interface MountedFileSecretReaderOptions {
  readonly maxBytes?: number;
}

export class MountedFileSecretReader implements SecretReaderPort {
  private readonly rootDirectory: string;
  private readonly maxBytes: number;

  constructor(rootDirectory: string, options: MountedFileSecretReaderOptions = {}) {
    if (!isAbsolute(rootDirectory)) {
      throw new TypeError('Mounted secret directory must be absolute.');
    }
    this.rootDirectory = resolve(rootDirectory);
    this.maxBytes = options.maxBytes ?? DEFAULT_MOUNTED_SECRET_MAX_BYTES;
    if (!Number.isInteger(this.maxBytes) || this.maxBytes < 1) {
      throw new RangeError('Mounted secret maximum size must be a positive integer.');
    }
  }

  async readSecret(name: string, options: SecretReadOptions = {}): Promise<string> {
    if (!SECRET_FILE_NAME.test(name)) {
      throw this.error(name, 'INVALID_PATH');
    }
    throwIfAborted(options.signal);

    const filePath = resolve(this.rootDirectory, name);
    if (!isWithinRoot(this.rootDirectory, filePath)) {
      throw this.error(name, 'INVALID_PATH');
    }

    try {
      const [rootPath, metadata] = await Promise.all([
        realpath(this.rootDirectory),
        lstat(filePath),
      ]);
      if (metadata.isSymbolicLink() || !metadata.isFile()) {
        throw this.error(name, 'UNSAFE_FILE');
      }
      if (metadata.size > this.maxBytes) {
        throw this.error(name, 'TOO_LARGE');
      }

      const canonicalFilePath = await realpath(filePath);
      if (!isWithinRoot(rootPath, canonicalFilePath)) {
        throw this.error(name, 'INVALID_PATH');
      }

      const value = await readFile(canonicalFilePath, 'utf8');
      throwIfAborted(options.signal);
      const normalized = value.trim();
      if (!normalized) {
        throw this.error(name, 'MISSING');
      }
      return normalized;
    } catch (error) {
      if (error instanceof SecretReadError) {
        throw error;
      }
      throw this.error(name, mapFileError(error), error);
    }
  }

  readRequiredSecrets(
    names: readonly string[],
    options: SecretReadOptions = {},
  ): Promise<Record<string, string>> {
    return readRequiredSecretsWith(this, names, options);
  }

  private error(name: string, code: SecretReadErrorCode, cause?: unknown): SecretReadError {
    return new SecretReadError({ source: 'mounted-files', secretName: name, code, cause });
  }
}

function isWithinRoot(root: string, candidate: string): boolean {
  const childPath = relative(root, candidate);
  return childPath !== '..' && !childPath.startsWith(`..${sep}`);
}

function mapFileError(error: unknown): SecretReadErrorCode {
  const code = getErrorCode(error);
  if (code === 'ENOENT' || code === 'ENOTDIR') return 'MISSING';
  if (code === 'EACCES' || code === 'EPERM') return 'ACCESS_DENIED';
  return 'UNKNOWN';
}

function getErrorCode(error: unknown): string | undefined {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new SecretReadError({
      source: 'mounted-files',
      secretName: 'aborted',
      code: 'TRANSIENT',
    });
  }
}
