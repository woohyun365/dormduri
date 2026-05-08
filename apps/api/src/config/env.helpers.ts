export function readStringEnv(env: NodeJS.ProcessEnv, key: string, fallback?: string): string {
  const raw = env[key]?.trim();
  if (raw) {
    return raw;
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`[config] ${key} is required.`);
}

export function readNumberEnv(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  options?: { min?: number },
): number {
  const raw = env[key]?.trim();
  const value = raw ? Number(raw) : fallback;

  if (!Number.isFinite(value)) {
    throw new Error(`[config] ${key} must be a finite number.`);
  }

  if (options?.min !== undefined && value < options.min) {
    throw new Error(`[config] ${key} must be at least ${options.min}.`);
  }

  return value;
}

export function readBooleanEnv(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = env[key]?.trim().toLowerCase();

  if (!raw) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on'].includes(raw)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(raw)) {
    return false;
  }

  throw new Error(`[config] ${key} must be a boolean-like value.`);
}
