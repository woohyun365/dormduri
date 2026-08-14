export const AUTH_CODE_REQUEST_MIN_RESPONSE_MILLISECONDS = 400;

async function delayMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureMinVerificationResponseDuration(
  startedAt: number,
  minimumMs: number,
): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < minimumMs) {
    await delayMs(minimumMs - elapsed);
  }
}
