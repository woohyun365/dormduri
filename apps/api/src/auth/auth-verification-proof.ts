const UNCONSUMED_VERIFICATION_CODE_WHERE = {
  consumedAt: null,
} as const;

export const SIGNUP_VERIFICATION_PROOF_UNAVAILABLE =
  '[AuthService] signup verification proof unavailable';
export const RESET_VERIFICATION_PROOF_UNAVAILABLE =
  '[AuthService] reset verification proof unavailable';

interface VerificationCodeConsumer {
  verificationCode: {
    updateMany(args: {
      where: { id: string; consumedAt: null };
      data: { consumedAt: Date };
    }): Promise<{ count: number }>;
  };
}

export async function consumeVerifiedCodeOrThrow(
  tx: VerificationCodeConsumer,
  verificationCodeId: string,
  consumedAt: Date,
  unavailableMessage: string,
): Promise<void> {
  const consumeResult = await tx.verificationCode.updateMany({
    where: {
      id: verificationCodeId,
      ...UNCONSUMED_VERIFICATION_CODE_WHERE,
    },
    data: { consumedAt },
  });

  if (consumeResult.count !== 1) {
    throw new Error(unavailableMessage);
  }
}
