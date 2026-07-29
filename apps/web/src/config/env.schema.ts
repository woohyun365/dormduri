const DEFAULT_APP_URL = 'http://localhost:3000';
const DEFAULT_API_UPSTREAM_URL = 'http://localhost:4000';
const DEFAULT_PUBLIC_API_BASE = '/api';

const LOCAL_API_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

type RawWebEnv = Partial<Record<string, string | undefined>>;

export type WebRuntimeMode = 'development' | 'test' | 'production';

export type WebServerEnv = {
  appUrl: string;
  apiUpstreamUrl: string;
  publicApiBase: string;
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
  };
}
