export class HealthReadinessTimeoutError extends Error {
  constructor(
    readonly checkName: string,
    readonly timeoutMs: number,
  ) {
    super(`[health] ${checkName} readiness check timed out after ${timeoutMs}ms`);
    this.name = 'HealthReadinessTimeoutError';
  }
}

export async function withReadinessTimeout<T>(
  checkName: string,
  operation: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new HealthReadinessTimeoutError(checkName, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}
