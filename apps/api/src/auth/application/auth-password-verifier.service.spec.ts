import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPasswordVerifier } from './auth-password-verifier.service.js';
import { verifyPasswordHash } from '../credentials/password-hashing/password-hash.js';

vi.mock('../credentials/password-hashing/password-hash.js', () => ({
  verifyPasswordHash: vi.fn(),
}));

describe('AuthPasswordVerifier', () => {
  const verifier = new AuthPasswordVerifier();

  beforeEach(() => {
    vi.mocked(verifyPasswordHash).mockReset();
  });

  it('account deletion verification uses the bounded internal admission operation', async () => {
    vi.mocked(verifyPasswordHash).mockResolvedValue(true);

    await expect(verifier.verifyAccountPassword('encoded-hash', 'candidate')).resolves.toBe(true);

    expect(verifyPasswordHash).toHaveBeenCalledWith(
      'encoded-hash',
      'candidate',
      'account_deletion_verify',
    );
  });

  it('preserves password hash capacity failures for the caller boundary', async () => {
    const capacityFailure = new Error('capacity unavailable');
    vi.mocked(verifyPasswordHash).mockRejectedValue(capacityFailure);

    await expect(verifier.verifyAccountPassword('encoded-hash', 'candidate')).rejects.toBe(
      capacityFailure,
    );
  });
});
