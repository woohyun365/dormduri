import type { BackofficeTransaction } from '../platform/database/backoffice-prisma.js';
import { generateRecoveryCodes, hashRecoveryCode } from './crypto/recovery-codes.js';
import type { SecretBox } from './crypto/secret-box.js';
import { encodeBase32, generateTotpSecret, totpProvisioningUri } from './crypto/totp.js';
import { totpAssociatedData } from './login/admin-login.service.js';

export interface IssuedTotp {
  /** Base32 secret and otpauth URI, shown once for the authenticator app. */
  readonly secret: string;
  readonly uri: string;
}

/**
 * TOTP and recovery codes are re-registration factors only (OA-R2): they open a recovery-scope
 * session. A new TOTP stays unconfirmed until the operator enters one code from it.
 */
export class CredentialIssuer {
  constructor(private readonly secretBox: SecretBox) {}

  async issueTotp(
    tx: BackofficeTransaction,
    accountId: string,
    accountLabel: string,
  ): Promise<IssuedTotp> {
    const secret = generateTotpSecret();
    const secretCiphertext = this.secretBox.seal(secret, totpAssociatedData(accountId));
    await tx.adminTotpCredential.upsert({
      where: { accountId },
      create: { accountId, secretCiphertext },
      update: { secretCiphertext, confirmedAt: null, lastUsedTimeStep: null },
    });
    return { secret: encodeBase32(secret), uri: totpProvisioningUri(secret, accountLabel) };
  }

  async issueRecoveryCodes(tx: BackofficeTransaction, accountId: string): Promise<string[]> {
    const codes = generateRecoveryCodes();
    await tx.adminRecoveryCode.deleteMany({ where: { accountId } });
    await tx.adminRecoveryCode.createMany({
      data: codes.map((code) => ({ accountId, codeHash: hashRecoveryCode(code) })),
    });
    return codes;
  }
}
