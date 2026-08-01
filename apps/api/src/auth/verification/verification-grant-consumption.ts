import type { VerificationCodePurpose } from '../../generated/prisma/enums.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { acquireTransactionAdvisoryLock } from '../../generated/prisma/sql.js';
import {
  getVerificationCodePurposeLockKey,
  VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
} from './auth-verification-lock.js';

export const SIGNUP_VERIFICATION_GRANT_UNAVAILABLE =
  '[AuthService] signup verification grant unavailable';
export const RESET_VERIFICATION_GRANT_UNAVAILABLE =
  '[AuthService] reset verification grant unavailable';

type VerificationCodeConsumer = Pick<
  Prisma.TransactionClient,
  '$queryRawTyped' | 'verificationCode'
>;

export async function acquireVerificationCodePurposeLock(
  tx: VerificationCodeConsumer,
  subjectKey: string,
  purpose: VerificationCodePurpose,
): Promise<void> {
  await tx.$queryRawTyped(
    acquireTransactionAdvisoryLock(
      VERIFICATION_CODE_PURPOSE_LOCK_NAMESPACE,
      getVerificationCodePurposeLockKey(subjectKey, purpose),
    ),
  );
}

export async function consumeVerificationGrantOrThrow(
  tx: VerificationCodeConsumer,
  input: {
    id: string;
    purpose: VerificationCodePurpose;
    tokenHash: string;
  },
  consumedAt: Date,
  unavailableMessage: string,
): Promise<void> {
  const result = await tx.verificationCode.updateMany({
    where: {
      id: input.id,
      purpose: input.purpose,
      grantTokenHash: input.tokenHash,
      verifiedAt: { not: null },
      grantExpiresAt: { gt: consumedAt },
      consumedAt: null,
    },
    data: { consumedAt },
  });

  if (result.count !== 1) {
    throw new Error(unavailableMessage);
  }
}
