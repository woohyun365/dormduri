import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRuntimeBootstrapReceipt,
  createRuntimeBootstrapReceipt,
  recordRuntimeBootstrapReceipt,
} from '../../platform/runtime/bootstrap/runtime-bootstrap-receipt.js';
import { RuntimeBootstrapHealthCheck } from './runtime-bootstrap-health.check.js';

describe('RuntimeBootstrapHealthCheck', () => {
  afterEach(() => clearRuntimeBootstrapReceipt());

  it.each(['env', 'mounted-files', 'aws-secrets-manager'] as const)(
    '%s receipt를 동일한 secret-free 준비 완료 증거로 처리한다',
    async (secretSource) => {
      recordRuntimeBootstrapReceipt(
        createRuntimeBootstrapReceipt({
          secretSource,
          materializedSecretCount: secretSource === 'env' ? 0 : 13,
          completedAt: new Date('2026-08-12T00:00:00.000Z'),
        }),
      );

      await expect(new RuntimeBootstrapHealthCheck().check()).resolves.toMatchObject({
        name: 'runtimeBootstrap',
        status: 'up',
        code: 'RUNTIME_BOOTSTRAP_PREPARED',
      });
    },
  );

  it('receipt가 없으면 readiness를 fail-closed한다', async () => {
    await expect(new RuntimeBootstrapHealthCheck().check()).resolves.toMatchObject({
      status: 'down',
      code: 'RUNTIME_BOOTSTRAP_UNAVAILABLE',
    });
  });
});
