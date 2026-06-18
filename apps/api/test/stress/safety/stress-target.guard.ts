export const STRESS_PRODUCTION_OVERRIDE_VALUE = 'I_UNDERSTAND' as const;

export type StressEnvironment = 'local' | 'staging' | 'production';

export interface StressTargetGuardInput {
  readonly targetUrl?: string;
  readonly stressEnv?: string;
  readonly nodeEnv?: string;
  readonly allowedHosts?: readonly string[] | string;
  readonly allowProduction?: string;
}

export interface StressTargetGuardResult {
  readonly targetUrl: string;
  readonly stressEnv: StressEnvironment;
  readonly hostname: string;
  readonly allowedHosts: readonly string[];
  readonly isLocalTarget: boolean;
  readonly isPrivateNetworkTarget: boolean;
  readonly isExplicitlyAllowedHost: boolean;
  readonly productionOverride: boolean;
  readonly warnings: readonly string[];
}

export class StressTargetGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StressTargetGuardError';
  }
}

export function resolveStressTargetGuardInputFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): StressTargetGuardInput {
  return {
    targetUrl: env.STRESS_TARGET_URL,
    stressEnv: env.STRESS_ENV,
    nodeEnv: env.NODE_ENV,
    allowedHosts: env.STRESS_ALLOWED_HOSTS,
    allowProduction: env.STRESS_ALLOW_PRODUCTION,
  };
}

export function assertStressTargetAllowed(input: StressTargetGuardInput): StressTargetGuardResult {
  const result = evaluateStressTarget(input);

  if (!result.allowed) {
    throw new StressTargetGuardError(result.reason);
  }

  return result.target;
}

export function evaluateStressTarget(
  input: StressTargetGuardInput,
):
  | { readonly allowed: true; readonly target: StressTargetGuardResult }
  | { readonly allowed: false; readonly reason: string } {
  if (!input.targetUrl?.trim()) {
    return {
      allowed: false,
      reason: 'STRESS_TARGET_URL is required before stress seed/reset runs.',
    };
  }

  const targetUrl = parseTargetUrl(input.targetUrl);
  if (!targetUrl.ok) {
    return { allowed: false, reason: targetUrl.reason };
  }

  if (targetUrl.url.username || targetUrl.url.password) {
    return {
      allowed: false,
      reason: 'STRESS_TARGET_URL must not embed credentials. Use environment secrets instead.',
    };
  }

  if (!['http:', 'https:'].includes(targetUrl.url.protocol)) {
    return {
      allowed: false,
      reason: `Stress target protocol ${targetUrl.url.protocol} is not allowed. Use http or https.`,
    };
  }

  const stressEnv = normalizeStressEnvironment(input.stressEnv);
  const allowedHosts = parseAllowedHosts(input.allowedHosts);
  const hostname = targetUrl.url.hostname.toLowerCase();
  const productionOverride = input.allowProduction === STRESS_PRODUCTION_OVERRIDE_VALUE;
  const isLocalTarget = isLocalHostname(hostname);
  const isPrivateNetworkTarget = isPrivateIpv4(hostname);
  const isExplicitlyAllowedHost = isAllowedHost(hostname, allowedHosts);
  const nodeEnvIsProduction = input.nodeEnv === 'production';
  const stressEnvIsProduction = stressEnv === 'production';
  const safeTarget = isLocalTarget || isPrivateNetworkTarget || isExplicitlyAllowedHost;
  const productionLikeTarget = !safeTarget || nodeEnvIsProduction || stressEnvIsProduction;

  if (productionLikeTarget && !productionOverride) {
    return {
      allowed: false,
      reason: [
        `Stress target ${hostname} is production-like or not allowlisted.`,
        `Set STRESS_ALLOWED_HOSTS for staging/private targets or STRESS_ALLOW_PRODUCTION=${STRESS_PRODUCTION_OVERRIDE_VALUE} for an approved production run.`,
      ].join(' '),
    };
  }

  return {
    allowed: true,
    target: {
      targetUrl: targetUrl.url.toString(),
      stressEnv,
      hostname,
      allowedHosts,
      isLocalTarget,
      isPrivateNetworkTarget,
      isExplicitlyAllowedHost,
      productionOverride,
      warnings: productionOverride
        ? [
            'Production override is enabled. Run only with explicit approval, approved fixture scope, and release-window monitoring.',
          ]
        : [],
    },
  };
}

function parseTargetUrl(
  targetUrl: string,
): { readonly ok: true; readonly url: URL } | { readonly ok: false; readonly reason: string } {
  try {
    return { ok: true, url: new URL(targetUrl) };
  } catch {
    return { ok: false, reason: `STRESS_TARGET_URL is not a valid URL: ${targetUrl}` };
  }
}

function normalizeStressEnvironment(input: string | undefined): StressEnvironment {
  const normalized = input?.trim().toLowerCase();

  if (normalized === 'staging' || normalized === 'stage') {
    return 'staging';
  }

  if (normalized === 'production' || normalized === 'prod') {
    return 'production';
  }

  return 'local';
}

function parseAllowedHosts(input: StressTargetGuardInput['allowedHosts']): readonly string[] {
  if (!input) {
    return [];
  }

  const values = typeof input === 'string' ? input.split(/[\s,]+/u) : [...input];

  return values.map((value: string) => value.trim().toLowerCase()).filter(Boolean);
}

function isAllowedHost(hostname: string, allowedHosts: readonly string[]): boolean {
  return allowedHosts.some((allowedHost) => {
    if (allowedHost.startsWith('*.')) {
      const suffix = allowedHost.slice(1);
      return hostname.endsWith(suffix) && hostname.length > suffix.length;
    }

    return hostname === allowedHost;
  });
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname === 'host.docker.internal' ||
    hostname.endsWith('.localhost')
  );
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map((part) => Number.parseInt(part, 10));
  if (
    octets.length !== 4 ||
    octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  const first = octets[0];
  const second = octets[1];

  return (
    first === 10 ||
    (first === 172 && second !== undefined && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}
