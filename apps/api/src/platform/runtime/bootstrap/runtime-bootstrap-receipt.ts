import type { SecretSource } from '../secret-source.config.js';

export const RUNTIME_BOOTSTRAP_RECEIPT_VERSION = 1 as const;

export interface RuntimeBootstrapReceipt {
  readonly version: typeof RUNTIME_BOOTSTRAP_RECEIPT_VERSION;
  readonly status: 'prepared';
  readonly secretSource: SecretSource;
  readonly materializedSecretCount: number;
  readonly completedAt: string;
}

let currentReceipt: RuntimeBootstrapReceipt | null = null;

export function createRuntimeBootstrapReceipt(input: {
  readonly secretSource: SecretSource;
  readonly materializedSecretCount: number;
  readonly completedAt: Date;
}): RuntimeBootstrapReceipt {
  return Object.freeze({
    version: RUNTIME_BOOTSTRAP_RECEIPT_VERSION,
    status: 'prepared',
    secretSource: input.secretSource,
    materializedSecretCount: input.materializedSecretCount,
    completedAt: input.completedAt.toISOString(),
  });
}

export function recordRuntimeBootstrapReceipt(receipt: RuntimeBootstrapReceipt): void {
  currentReceipt = receipt;
}

export function readRuntimeBootstrapReceipt(): RuntimeBootstrapReceipt | null {
  return currentReceipt;
}

export function clearRuntimeBootstrapReceipt(): void {
  currentReceipt = null;
}
