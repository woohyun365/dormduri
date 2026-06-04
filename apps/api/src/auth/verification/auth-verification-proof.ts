import type { VerificationCodePurpose } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  acquireTransactionAdvisoryLock,
  consumeVerificationCodeProof,
} from '../../generated/prisma/sql.js';
import {
  getVerificationCodePurposeLockKey,
  VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
} from './auth-verification-lock.js';

export const SIGNUP_VERIFICATION_PROOF_UNAVAILABLE =
  '[AuthService] signup verification proof unavailable';
export const RESET_VERIFICATION_PROOF_UNAVAILABLE =
  '[AuthService] reset verification proof unavailable';

type VerificationCodeConsumer = Pick<Prisma.TransactionClient, '$queryRawTyped'>;

export async function acquireVerificationCodePurposeLock(
  tx: VerificationCodeConsumer,
  emailNormalized: string,
  purpose: VerificationCodePurpose,
): Promise<void> {
  await tx.$queryRawTyped(
    acquireTransactionAdvisoryLock(
      VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
      getVerificationCodePurposeLockKey(emailNormalized, purpose),
    ),
  );
}

export async function consumeVerifiedCodeOrThrow(
  tx: VerificationCodeConsumer,
  verificationCodeId: string,
  consumedAt: Date,
  unavailableMessage: string,
): Promise<void> {
  const rows = await tx.$queryRawTyped(
    consumeVerificationCodeProof(verificationCodeId, consumedAt),
  );

  if (rows.length !== 1) {
    throw new Error(unavailableMessage);
  }
}
