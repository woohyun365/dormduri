const DEFAULT_APP_URL = 'http://localhost:3000';
const DEFAULT_API_UPSTREAM_URL = 'http://localhost:4000';
const DEFAULT_PUBLIC_API_BASE = '/api';

const LOCAL_API_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

type RawWebEnv = Partial<Record<string, string | undefined>>;

export type WebRuntimeMode = 'development' | 'test' | 'production';

export type WebOperationalTelemetryEnv = {
  environment: 'local' | 'preview' | 'production';
  release: string;
  browserEnabled: boolean;
  runtimeErrorsEnabled: boolean;
  webVitalsEnabled: boolean;
  privacyApproved: boolean;
  retentionDays?: number;
  endpoint?: string;
  bffStructuredLoggingEnabled: boolean;
  bffSuccessSampleRate: number;
  sourceMapsEnabled: boolean;
};

export type WebServerEnv = {
  appUrl: string;
  apiUpstreamUrl: string;
  publicApiBase: string;
  operationalTelemetry: WebOperationalTelemetryEnv;
};

export class WebEnvValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'WebEnvValidationError';
  }
}

export const webEnvDefaults = {
  appUrl: DEFAULT_APP_URL,
  apiUpstreamUrl: DEFAULT_API_UPSTREAM_URL,
  publicApiBase: DEFAULT_PUBLIC_API_BASE,
  operationalTelemetry: {
    environment: 'local',
    release: 'development',
    browserEnabled: false,
    runtimeErrorsEnabled: false,
    webVitalsEnabled: false,
    privacyApproved: false,
    bffStructuredLoggingEnabled: false,
    bffSuccessSampleRate: 0.25,
    sourceMapsEnabled: false,
  },
} as const;

export function normalizeWebRuntimeMode(input: string | undefined): WebRuntimeMode {
  if (input === 'production') return 'production';
  if (input === 'test') return 'test';
  return 'development';
}

function readEnvValue(rawEnv: RawWebEnv, key: string): string | undefined {
  const value = rawEnv[key]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function normalizeHttpUrl(input: string, key: string): { value: string; url: URL } {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new WebEnvValidationError(
      `${key} must be an absolute http(s) URL.`,
      `${key}_INVALID_URL`,
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new WebEnvValidationError(`${key} must use http or https.`, `${key}_INVALID_PROTOCOL`);
  }

  url.hash = '';
  url.search = '';
  const pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
  return {
    value: `${url.protocol}//${url.host}${pathname}`,
    url,
  };
}

function assertProductionNonLocalUrl(input: {
  key: string;
  rawValue: string | undefined;
  normalized: { url: URL };
  runtimeMode: WebRuntimeMode;
}): void {
  if (input.runtimeMode !== 'production') {
    return;
  }

  if (!input.rawValue) {
    throw new WebEnvValidationError(
      `${input.key} is required in production runtime.`,
      `${input.key}_REQUIRED_IN_PRODUCTION`,
    );
  }

  if (LOCAL_API_HOSTNAMES.has(input.normalized.url.hostname)) {
    throw new WebEnvValidationError(
      `${input.key} must not point to localhost in production runtime.`,
      `${input.key}_LOCALHOST_IN_PRODUCTION`,
    );
  }
}

function assertProductionPublicHttpsUrl(input: {
  rawValue: string | undefined;
  normalized: { url: URL };
  runtimeMode: WebRuntimeMode;
}): void {
  if (input.runtimeMode !== 'production') {
    return;
  }
  if (!input.rawValue) {
    throw new WebEnvValidationError(
      'NEXT_PUBLIC_APP_URL is required in production runtime.',
      'NEXT_PUBLIC_APP_URL_REQUIRED_IN_PRODUCTION',
    );
  }
  if (input.normalized.url.protocol !== 'https:') {
    throw new WebEnvValidationError(
      'NEXT_PUBLIC_APP_URL must use https in production runtime.',
      'NEXT_PUBLIC_APP_URL_HTTPS_REQUIRED_IN_PRODUCTION',
    );
  }
}

function normalizePublicApiBase(input: string): string {
  if (input.startsWith('/') && !input.startsWith('//')) {
    const parsed = new URL(input, 'https://web.local');
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${pathname}${parsed.search}`;
  }

  return normalizeHttpUrl(input, 'NEXT_PUBLIC_API_URL').value;
}

function readBooleanFlag(rawEnv: RawWebEnv, key: string): boolean {
  return readEnvValue(rawEnv, key) === '1';
}

function normalizeTelemetryEnvironment(
  rawEnv: RawWebEnv,
  runtimeMode: WebRuntimeMode,
): WebOperationalTelemetryEnv['environment'] {
  const value = readEnvValue(rawEnv, 'NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT');
  if (value === 'preview') return 'preview';
  if (value === 'production' || runtimeMode === 'production') return 'production';
  return 'local';
}

function parseRetentionDays(rawEnv: RawWebEnv): number | undefined {
  const value = readEnvValue(rawEnv, 'NEXT_PUBLIC_WEB_TELEMETRY_RETENTION_DAYS');
  if (!value) return undefined;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new WebEnvValidationError(
      'NEXT_PUBLIC_WEB_TELEMETRY_RETENTION_DAYS must be an integer between 1 and 365.',
      'NEXT_PUBLIC_WEB_TELEMETRY_RETENTION_DAYS_INVALID',
    );
  }
  return days;
}

function parseSampleRate(rawEnv: RawWebEnv, key: string, fallback: number): number {
  const value = readEnvValue(rawEnv, key);
  if (!value) return fallback;
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new WebEnvValidationError(`${key} must be between 0 and 1.`, `${key}_INVALID`);
  }
  return rate;
}

function parseOperationalTelemetryEnv(
  rawEnv: RawWebEnv,
  runtimeMode: WebRuntimeMode,
): WebOperationalTelemetryEnv {
  const browserEnabled = readBooleanFlag(rawEnv, 'NEXT_PUBLIC_WEB_OPERATIONAL_TELEMETRY_ENABLED');
  const privacyApproved = readBooleanFlag(rawEnv, 'NEXT_PUBLIC_WEB_TELEMETRY_PRIVACY_APPROVED');
  const endpointInput = readEnvValue(rawEnv, 'NEXT_PUBLIC_WEB_TELEMETRY_ENDPOINT');
  const retentionDays = parseRetentionDays(rawEnv);
  let endpoint: string | undefined;

  if (endpointInput) {
    const normalized = normalizeHttpUrl(endpointInput, 'NEXT_PUBLIC_WEB_TELEMETRY_ENDPOINT');
    if (runtimeMode === 'production' && normalized.url.protocol !== 'https:') {
      throw new WebEnvValidationError(
        'NEXT_PUBLIC_WEB_TELEMETRY_ENDPOINT must use https in production runtime.',
        'NEXT_PUBLIC_WEB_TELEMETRY_ENDPOINT_HTTPS_REQUIRED_IN_PRODUCTION',
      );
    }
    endpoint = normalized.value;
  }

  if (runtimeMode === 'production' && browserEnabled) {
    if (!privacyApproved) {
      throw new WebEnvValidationError(
        'Browser operational telemetry requires an approved privacy gate in production.',
        'WEB_TELEMETRY_PRIVACY_GATE_REQUIRED',
      );
    }
    if (!retentionDays) {
      throw new WebEnvValidationError(
        'Browser operational telemetry retention must be declared in production.',
        'WEB_TELEMETRY_RETENTION_REQUIRED',
      );
    }
    if (!endpoint) {
      throw new WebEnvValidationError(
        'Browser operational telemetry endpoint is required in production.',
        'WEB_TELEMETRY_ENDPOINT_REQUIRED',
      );
    }
  }

  return {
    environment: normalizeTelemetryEnvironment(rawEnv, runtimeMode),
    release: readEnvValue(rawEnv, 'NEXT_PUBLIC_WEB_RELEASE') ?? 'development',
    browserEnabled,
    runtimeErrorsEnabled:
      browserEnabled && readEnvValue(rawEnv, 'NEXT_PUBLIC_WEB_RUNTIME_ERRORS_ENABLED') !== '0',
    webVitalsEnabled:
      browserEnabled && readEnvValue(rawEnv, 'NEXT_PUBLIC_WEB_VITALS_ENABLED') !== '0',
    privacyApproved,
    ...(retentionDays ? { retentionDays } : {}),
    ...(endpoint ? { endpoint } : {}),
    bffStructuredLoggingEnabled:
      readBooleanFlag(rawEnv, 'WEB_BFF_OPERATIONAL_LOGGING_ENABLED') ||
      runtimeMode === 'production',
    bffSuccessSampleRate: parseSampleRate(rawEnv, 'WEB_BFF_SUCCESS_SAMPLE_RATE', 0.25),
    sourceMapsEnabled: readBooleanFlag(rawEnv, 'WEB_BROWSER_SOURCE_MAPS_ENABLED'),
  };
}

export function parseWebServerEnv(
  rawEnv: RawWebEnv,
  runtimeMode: WebRuntimeMode = normalizeWebRuntimeMode(rawEnv.NODE_ENV),
): WebServerEnv {
  const appUrlInput = readEnvValue(rawEnv, 'NEXT_PUBLIC_APP_URL');
  const apiUrlInput = readEnvValue(rawEnv, 'API_URL');
  const publicApiBaseInput = readEnvValue(rawEnv, 'NEXT_PUBLIC_API_URL');

  const appUrl = normalizeHttpUrl(appUrlInput ?? DEFAULT_APP_URL, 'NEXT_PUBLIC_APP_URL');
  assertProductionNonLocalUrl({
    key: 'NEXT_PUBLIC_APP_URL',
    rawValue: appUrlInput,
    normalized: appUrl,
    runtimeMode,
  });
  assertProductionPublicHttpsUrl({
    rawValue: appUrlInput,
    normalized: appUrl,
    runtimeMode,
  });

  const apiUpstreamUrl = normalizeHttpUrl(apiUrlInput ?? DEFAULT_API_UPSTREAM_URL, 'API_URL');
  assertProductionNonLocalUrl({
    key: 'API_URL',
    rawValue: apiUrlInput,
    normalized: apiUpstreamUrl,
    runtimeMode,
  });

  return {
    appUrl: appUrl.value,
    apiUpstreamUrl: apiUpstreamUrl.value,
    publicApiBase: normalizePublicApiBase(publicApiBaseInput ?? DEFAULT_PUBLIC_API_BASE),
    operationalTelemetry: parseOperationalTelemetryEnv(rawEnv, runtimeMode),
  };
}
