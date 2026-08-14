const DEFAULT_APP_URL = 'http://localhost:3000';
const DEFAULT_API_UPSTREAM_URL = 'http://localhost:4000';
const DEFAULT_PUBLIC_API_BASE = '/api';

const LOCAL_API_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

type RawWebEnv = Partial<Record<string, string | undefined>>;

export type WebEnvScope = 'build-public' | 'build-secret' | 'build-server' | 'runtime-server';
export type WebEnvRequirement =
  | 'production-required'
  | 'target-required'
  | 'optional'
  | 'safe-default';

export type WebEnvDefinition = Readonly<{
  key: string;
  scope: WebEnvScope;
  requirement: WebEnvRequirement;
  secret?: boolean;
}>;

export const WEB_ENV_KEYS = [
  { key: 'NEXT_PUBLIC_APP_URL', scope: 'build-public', requirement: 'target-required' },
  { key: 'NEXT_PUBLIC_API_URL', scope: 'build-public', requirement: 'safe-default' },
  { key: 'NEXT_PUBLIC_SENTRY_ENABLED', scope: 'build-public', requirement: 'safe-default' },
  { key: 'NEXT_PUBLIC_SENTRY_DSN', scope: 'build-public', requirement: 'optional' },
  {
    key: 'NEXT_PUBLIC_SENTRY_RUNTIME_ERRORS_ENABLED',
    scope: 'build-public',
    requirement: 'safe-default',
  },
  {
    key: 'NEXT_PUBLIC_SENTRY_PERFORMANCE_ENABLED',
    scope: 'build-public',
    requirement: 'safe-default',
  },
  {
    key: 'NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE',
    scope: 'build-public',
    requirement: 'safe-default',
  },
  {
    key: 'NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED',
    scope: 'build-public',
    requirement: 'safe-default',
  },
  {
    key: 'NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED',
    scope: 'build-public',
    requirement: 'safe-default',
  },
  {
    key: 'NEXT_PUBLIC_SENTRY_LOCAL_RECORDING',
    scope: 'build-public',
    requirement: 'optional',
  },
  {
    key: 'NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT',
    scope: 'build-public',
    requirement: 'target-required',
  },
  { key: 'NEXT_PUBLIC_WEB_RELEASE', scope: 'build-public', requirement: 'target-required' },
  {
    key: 'NEXT_PUBLIC_WEB_OPERATIONAL_DEBUG',
    scope: 'build-public',
    requirement: 'optional',
  },
  {
    key: 'NEXT_PUBLIC_SENTRY_RECORDING_TRANSPORT_REJECT',
    scope: 'build-public',
    requirement: 'optional',
  },
  { key: 'WEB_APP_URL', scope: 'runtime-server', requirement: 'target-required' },
  { key: 'API_URL', scope: 'runtime-server', requirement: 'target-required' },
  {
    key: 'WEB_OBSERVABILITY_ENVIRONMENT',
    scope: 'runtime-server',
    requirement: 'target-required',
  },
  { key: 'WEB_RELEASE', scope: 'runtime-server', requirement: 'target-required' },
  {
    key: 'WEB_BFF_OPERATIONAL_LOGGING_ENABLED',
    scope: 'runtime-server',
    requirement: 'safe-default',
  },
  {
    key: 'WEB_BFF_SUCCESS_SAMPLE_RATE',
    scope: 'runtime-server',
    requirement: 'safe-default',
  },
  {
    key: 'SENTRY_SOURCE_MAP_UPLOAD_ENABLED',
    scope: 'build-server',
    requirement: 'safe-default',
  },
  {
    key: 'SENTRY_RELEASE_EVIDENCE_APPROVED',
    scope: 'build-server',
    requirement: 'safe-default',
  },
  { key: 'SENTRY_ORG', scope: 'build-server', requirement: 'target-required' },
  { key: 'SENTRY_PROJECT', scope: 'build-server', requirement: 'target-required' },
  { key: 'SENTRY_RELEASE', scope: 'build-server', requirement: 'target-required' },
  {
    key: 'SENTRY_AUTH_TOKEN',
    scope: 'build-secret',
    requirement: 'target-required',
    secret: true,
  },
] as const satisfies readonly WebEnvDefinition[];

function webEnvKeysForScope(scope: WebEnvScope): readonly string[] {
  return WEB_ENV_KEYS.filter((definition) => definition.scope === scope).map(({ key }) => key);
}

export const WEB_BUILD_PUBLIC_ENV_KEYS = webEnvKeysForScope('build-public');
export const WEB_BUILD_SECRET_ENV_KEYS = webEnvKeysForScope('build-secret');
export const WEB_BUILD_SERVER_ENV_KEYS = webEnvKeysForScope('build-server');
export const WEB_RUNTIME_SERVER_ENV_KEYS = webEnvKeysForScope('runtime-server');

export type WebRuntimeMode = 'development' | 'test' | 'production';

export type WebOperationalTelemetryEnv = {
  environment: 'local' | 'preview' | 'production';
  release: string;
  bffStructuredLoggingEnabled: boolean;
  bffSuccessSampleRate: number;
};

export type WebSentryEnv = {
  enabled: boolean;
  runtimeErrorsEnabled: boolean;
  performanceEnabled: boolean;
  privacyApproved: boolean;
  releaseEvidenceApproved: boolean;
  localRecordingEnabled: boolean;
  tracesSampleRate: number;
  dsn?: string;
};

export type WebServerEnv = {
  appUrl: string;
  apiUpstreamUrl: string;
  publicApiBase: string;
  operationalTelemetry: WebOperationalTelemetryEnv;
  sentry: WebSentryEnv;
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
    bffStructuredLoggingEnabled: false,
    bffSuccessSampleRate: 0.25,
  },
  sentry: {
    enabled: false,
    runtimeErrorsEnabled: false,
    performanceEnabled: false,
    privacyApproved: false,
    releaseEvidenceApproved: false,
    localRecordingEnabled: false,
    tracesSampleRate: 0.1,
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
  if (input.runtimeMode !== 'production') return;

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
  if (input.runtimeMode !== 'production') return;
  if (!input.rawValue) {
    throw new WebEnvValidationError(
      'WEB_APP_URL is required in production runtime.',
      'WEB_APP_URL_REQUIRED_IN_PRODUCTION',
    );
  }
  if (input.normalized.url.protocol !== 'https:') {
    throw new WebEnvValidationError(
      'WEB_APP_URL must use https in production runtime.',
      'WEB_APP_URL_HTTPS_REQUIRED_IN_PRODUCTION',
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
  const value = readEnvValue(rawEnv, 'WEB_OBSERVABILITY_ENVIRONMENT');
  if (value === 'preview') return 'preview';
  if (value === 'production' || runtimeMode === 'production') return 'production';
  return 'local';
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

function parseFailOpenSampleRate(rawEnv: RawWebEnv, key: string, fallback: number): number {
  const value = readEnvValue(rawEnv, key);
  if (!value) return fallback;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : fallback;
}

function parseOperationalTelemetryEnv(
  rawEnv: RawWebEnv,
  runtimeMode: WebRuntimeMode,
): WebOperationalTelemetryEnv {
  return {
    environment: normalizeTelemetryEnvironment(rawEnv, runtimeMode),
    release: readEnvValue(rawEnv, 'WEB_RELEASE') ?? 'development',
    bffStructuredLoggingEnabled:
      readBooleanFlag(rawEnv, 'WEB_BFF_OPERATIONAL_LOGGING_ENABLED') ||
      runtimeMode === 'production',
    bffSuccessSampleRate: parseSampleRate(rawEnv, 'WEB_BFF_SUCCESS_SAMPLE_RATE', 0.25),
  };
}

export function parseWebSentryEnv(rawEnv: RawWebEnv, runtimeMode: WebRuntimeMode): WebSentryEnv {
  const requested = readBooleanFlag(rawEnv, 'NEXT_PUBLIC_SENTRY_ENABLED');
  const privacyApproved = readBooleanFlag(rawEnv, 'NEXT_PUBLIC_SENTRY_PRIVACY_APPROVED');
  const releaseEvidenceApproved = readBooleanFlag(
    rawEnv,
    'NEXT_PUBLIC_SENTRY_RELEASE_EVIDENCE_APPROVED',
  );
  const localRecordingEnabled =
    runtimeMode !== 'production' && readBooleanFlag(rawEnv, 'NEXT_PUBLIC_SENTRY_LOCAL_RECORDING');
  const dsnInput = readEnvValue(rawEnv, 'NEXT_PUBLIC_SENTRY_DSN');
  let dsn: string | undefined;

  if (dsnInput) {
    try {
      const normalized = normalizeHttpUrl(dsnInput, 'NEXT_PUBLIC_SENTRY_DSN');
      if (normalized.url.protocol === 'https:') dsn = dsnInput;
    } catch {
      // Observability configuration is fail-open for the product runtime.
    }
  }

  const productionGateOpen =
    runtimeMode !== 'production' ||
    (privacyApproved &&
      releaseEvidenceApproved &&
      Boolean(dsn) &&
      readEnvValue(rawEnv, 'NEXT_PUBLIC_WEB_RELEASE') !== 'development' &&
      readEnvValue(rawEnv, 'NEXT_PUBLIC_WEB_RELEASE') !== undefined);
  const enabled = localRecordingEnabled || (requested && productionGateOpen);
  return {
    enabled,
    runtimeErrorsEnabled:
      enabled && readEnvValue(rawEnv, 'NEXT_PUBLIC_SENTRY_RUNTIME_ERRORS_ENABLED') !== '0',
    performanceEnabled:
      enabled && readEnvValue(rawEnv, 'NEXT_PUBLIC_SENTRY_PERFORMANCE_ENABLED') !== '0',
    privacyApproved,
    releaseEvidenceApproved,
    localRecordingEnabled,
    tracesSampleRate: parseFailOpenSampleRate(rawEnv, 'NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE', 0.1),
    ...(dsn ? { dsn } : {}),
  };
}

export function parseWebServerEnv(
  rawEnv: RawWebEnv,
  runtimeMode: WebRuntimeMode = normalizeWebRuntimeMode(rawEnv.NODE_ENV),
): WebServerEnv {
  const appUrlInput = readEnvValue(rawEnv, 'WEB_APP_URL');
  const apiUrlInput = readEnvValue(rawEnv, 'API_URL');
  const publicApiBaseInput = readEnvValue(rawEnv, 'NEXT_PUBLIC_API_URL');

  const appUrl = normalizeHttpUrl(appUrlInput ?? DEFAULT_APP_URL, 'WEB_APP_URL');
  assertProductionNonLocalUrl({
    key: 'WEB_APP_URL',
    rawValue: appUrlInput,
    normalized: appUrl,
    runtimeMode,
  });
  assertProductionPublicHttpsUrl({ rawValue: appUrlInput, normalized: appUrl, runtimeMode });

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
    sentry: parseWebSentryEnv(rawEnv, runtimeMode),
  };
}
