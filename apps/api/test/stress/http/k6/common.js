import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const STRESS_PRODUCTION_OVERRIDE_VALUE = 'I_UNDERSTAND';

export const skippedAuthRequests = new Rate('stress_skipped_auth_requests');
export const skippedWriteRequests = new Rate('stress_skipped_write_requests');

export function assertStressTargetAllowed(env = __ENV) {
  const targetUrl = env.STRESS_TARGET_URL;
  if (!targetUrl || !String(targetUrl).trim()) {
    throw new Error('STRESS_TARGET_URL is required before HTTP stress runs.');
  }

  const parsed = new URL(targetUrl);
  if (parsed.username || parsed.password) {
    throw new Error(
      'STRESS_TARGET_URL must not embed credentials. Use environment secrets instead.',
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Stress target protocol ${parsed.protocol} is not allowed. Use http or https.`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowedHosts = parseAllowedHosts(env.STRESS_ALLOWED_HOSTS);
  const isSafeTarget =
    isLocalHostname(hostname) || isPrivateIpv4(hostname) || isAllowedHost(hostname, allowedHosts);
  const stressEnv = normalizeStressEnvironment(env.STRESS_ENV);
  const productionLikeTarget = !isSafeTarget || stressEnv === 'production';
  const productionOverride = env.STRESS_ALLOW_PRODUCTION === STRESS_PRODUCTION_OVERRIDE_VALUE;

  if (productionLikeTarget && !productionOverride) {
    throw new Error(
      [
        `Stress target ${hostname} is production-like or not allowlisted.`,
        'Set STRESS_ALLOWED_HOSTS for staging/private targets',
        `or STRESS_ALLOW_PRODUCTION=${STRESS_PRODUCTION_OVERRIDE_VALUE} for an approved production run.`,
      ].join(' '),
    );
  }

  return {
    baseUrl: parsed.toString().replace(/\/$/u, ''),
    hostname,
    stressEnv,
    productionOverride,
  };
}

export function readPublicApiMix(target, tags = {}) {
  requestRead(target, '/health', { ...tags, endpoint: 'health' });
  requestRead(target, '/health/ready', { ...tags, endpoint: 'readiness' });
  requestRead(target, '/api/seasons/current?campus=CHUNCHEON', {
    ...tags,
    endpoint: 'current-season',
  });
}

export function readOptionalAuthenticatedMix(target, tags = {}) {
  const accessToken = __ENV.STRESS_ACCESS_TOKEN;
  if (!accessToken) {
    skippedAuthRequests.add(1, { ...tags, endpoint: 'optional-authenticated-read' });
    return;
  }

  const params = buildParams({
    ...tags,
    endpoint: 'roommate-search',
    authenticated: 'true',
  });
  params.headers.Authorization = `Bearer ${accessToken}`;

  const response = http.get(
    `${target.baseUrl}/api/roommate-search?campus=CHUNCHEON&pageSize=20&sort=MATCH_SCORE`,
    params,
  );

  check(response, {
    'authenticated read does not return 5xx': (res) => res.status < 500,
    'authenticated read is authorized or domain-valid': (res) =>
      res.status === 200 || res.status === 204 || res.status === 400 || res.status === 401,
  });
}

export function maybeRunWriteMix(tags = {}) {
  if (__ENV.STRESS_ENABLE_WRITE_MIX !== 'true') {
    skippedWriteRequests.add(1, { ...tags, endpoint: 'write-mix-disabled' });
    return false;
  }

  skippedWriteRequests.add(1, { ...tags, endpoint: 'write-mix-not-seeded' });
  return false;
}

export function pause(defaultSeconds = 1) {
  const seconds = Number.parseFloat(__ENV.STRESS_SLEEP_SECONDS || String(defaultSeconds));
  sleep(Number.isFinite(seconds) && seconds >= 0 ? seconds : defaultSeconds);
}

export function buildParams(tags = {}) {
  return {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'knu-roommate-k6-stress',
    },
    tags,
    timeout: __ENV.STRESS_REQUEST_TIMEOUT || '10s',
  };
}

function requestRead(target, path, tags) {
  const response = http.get(`${target.baseUrl}${path}`, buildParams(tags));

  check(response, {
    'read status is not 5xx': (res) => res.status < 500,
    'read status is expected': (res) => [200, 204, 404].includes(res.status),
  });

  return response;
}

function parseAllowedHosts(input) {
  if (!input) {
    return [];
  }

  return String(input)
    .split(/[\s,]+/u)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeStressEnvironment(input) {
  const normalized = String(input || 'local')
    .trim()
    .toLowerCase();

  if (normalized === 'production' || normalized === 'prod') {
    return 'production';
  }

  if (normalized === 'staging' || normalized === 'stage') {
    return 'staging';
  }

  return 'local';
}

function isAllowedHost(hostname, allowedHosts) {
  return allowedHosts.some((allowedHost) => {
    if (allowedHost.startsWith('*.')) {
      const suffix = allowedHost.slice(1);
      return hostname.endsWith(suffix) && hostname.length > suffix.length;
    }

    return hostname === allowedHost;
  });
}

function isLocalHostname(hostname) {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname === 'host.docker.internal' ||
    hostname.endsWith('.localhost')
  );
}

function isPrivateIpv4(hostname) {
  const octets = hostname.split('.').map((part) => Number.parseInt(part, 10));
  if (
    octets.length !== 4 ||
    octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)
  ) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}
