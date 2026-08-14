import { describe, expect, it, vi } from 'vitest';
import { cleanupIntegrationTestResources } from '../../integration/_support/integration-suite.js';

describe('integration suite cleanup', () => {
  it('app close가 실패해도 disposable database cleanup을 실행한다', async () => {
    const closeError = new Error('app close failed');
    const closeApp = vi.fn().mockRejectedValue(closeError);
    const cleanupDatabase = vi.fn().mockResolvedValue(undefined);

    await expect(cleanupIntegrationTestResources({ closeApp, cleanupDatabase })).rejects.toBe(
      closeError,
    );
    expect(closeApp).toHaveBeenCalledOnce();
    expect(cleanupDatabase).toHaveBeenCalledOnce();
  });

  it('두 cleanup이 모두 실패하면 두 원인을 보존한다', async () => {
    const closeError = new Error('app close failed');
    const databaseError = new Error('database cleanup failed');

    const error = await cleanupIntegrationTestResources({
      closeApp: vi.fn().mockRejectedValue(closeError),
      cleanupDatabase: vi.fn().mockRejectedValue(databaseError),
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([closeError, databaseError]);
  });
});
