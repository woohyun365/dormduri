import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export const STRESS_PRODUCTION_OVERRIDE_VALUE = 'I_UNDERSTAND';

export const skippedAuthRequests = new Rate('stress_skipped_auth_requests');
export const skippedWriteRequests = new Rate('stress_skipped_write_requests');

const actorTokenArtifact = loadActorTokenArtifact();
const PUBLIC_READ_EXPECTED_STATUSES = [200, 204, 404];
const AUTH_READ_EXPECTED_STATUSES = [200, 204, 400, 401, 403, 404];
const AUTH_WRITE_EXPECTED_STATUSES = [200, 201, 204, 400, 401, 403, 404, 409, 422, 429];

export function assertStressTargetAllowed(env = __ENV) {
  const targetUrl = env.STRESS_TARGET_URL;
  if (!targetUrl || !String(targetUrl).trim()) {
    throw new Error('STRESS_TARGET_URL is required before HTTP stress runs.');
  }

  const parsed = parseStressTargetUrl(targetUrl);
  if (parsed.hasCredentials) {
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
    baseUrl: parsed.href.replace(/\/$/u, ''),
    hostname,
    stressEnv,
    productionOverride,
  };
}

function parseStressTargetUrl(targetUrl) {
  const href = String(targetUrl).trim();
  const match = href.match(/^(https?):\/\/([^/?#]+)([/?#].*)?$/i);

  if (!match) {
    throw new Error('STRESS_TARGET_URL must be an absolute http(s) URL.');
  }

  const authority = match[2];
  const hostname = authority.startsWith('[')
    ? authority.slice(1, authority.indexOf(']'))
    : authority.split(':')[0];

  return {
    href,
    protocol: `${match[1].toLowerCase()}:`,
    hostname: hostname.toLowerCase(),
    hasCredentials: authority.includes('@'),
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
  const actor = pickActorToken();
  if (!actor) {
    skippedAuthRequests.add(1, { ...tags, endpoint: 'optional-authenticated-read' });
    return;
  }

  const choice = Math.abs((__VU || 1) + (__ITER || 0)) % 20;
  if (choice < 12) {
    requestAuthenticatedRead(
      target,
      '/api/roommate-search?campus=CHUNCHEON&pageSize=20&sort=MATCH_SCORE',
      actor,
      { ...tags, endpoint: 'roommate-search', authenticated: 'true' },
    );
    return;
  }

  if (choice < 15) {
    requestAuthenticatedRead(target, `/api/profiles/${actor.targetUserId}`, actor, {
      ...tags,
      endpoint: 'profile-detail',
      authenticated: 'true',
    });
    return;
  }

  const readPaths = [
    ['/api/chat/threads?limit=20', 'chat-threads'],
    ['/api/matches/requests', 'match-requests'],
    ['/api/matches/active', 'active-match'],
    ['/api/matches/history', 'match-history'],
    ['/api/bookmarks?sort=MATCH_SCORE&limit=20', 'bookmarks'],
    ['/api/notifications?limit=20', 'notifications'],
    ['/api/support/tickets?limit=20', 'support-tickets'],
  ];
  const [path, endpoint] = readPaths[choice - 15] || readPaths[0];
  requestAuthenticatedRead(target, path, actor, { ...tags, endpoint, authenticated: 'true' });
}

export function maybeRunWriteMix(target, tags = {}) {
  if (__ENV.STRESS_ENABLE_WRITE_MIX !== 'true') {
    skippedWriteRequests.add(1, { ...tags, endpoint: 'write-mix-disabled' });
    return false;
  }

  const actor = pickActorToken();
  if (!actor) {
    skippedWriteRequests.add(1, { ...tags, endpoint: 'write-mix-not-seeded' });
    return false;
  }

  const choice = Math.abs((__VU || 1) + (__ITER || 0)) % 10;
  const writeTags = { ...tags, authenticated: 'true' };

  if (choice < 3) {
    requestAuthenticatedWrite(target, 'POST', `/api/bookmarks/${actor.targetUserId}`, actor, null, {
      ...writeTags,
      endpoint: 'bookmark-create',
    });
    return true;
  }

  if (choice < 4) {
    requestAuthenticatedWrite(
      target,
      'DELETE',
      `/api/bookmarks/${actor.targetUserId}`,
      actor,
      null,
      {
        ...writeTags,
        endpoint: 'bookmark-delete',
      },
    );
    return true;
  }

  if (choice < 6) {
    requestAuthenticatedWrite(
      target,
      'POST',
      '/api/chat/messages',
      actor,
      {
        targetUserId: actor.targetUserId,
        body: `stress message ${__VU || 0}-${__ITER || 0}`,
        clientMessageId: `stress-${actor.actorId}-${__VU || 0}-${__ITER || 0}`,
      },
      { ...writeTags, endpoint: 'chat-message' },
    );
    return true;
  }

  if (choice < 7) {
    requestAuthenticatedWrite(target, 'POST', '/api/chat/realtime/tickets', actor, null, {
      ...writeTags,
      endpoint: 'chat-realtime-ticket',
    });
    return true;
  }

  if (choice < 8) {
    requestAuthenticatedWrite(
      target,
      'POST',
      '/api/matches/requests',
      actor,
      { targetUserId: actor.targetUserId, note: 'stress request' },
      { ...writeTags, endpoint: 'match-request-create' },
    );
    return true;
  }

  if (choice < 9) {
    requestAuthenticatedWrite(
      target,
      'POST',
      '/api/support/tickets',
      actor,
      {
        category: 'MATCHING',
        subject: 'stress support ticket',
        body: 'stress support body',
        relatedEntityId: actor.targetUserId,
        emailReplyConsent: false,
      },
      { ...writeTags, endpoint: 'support-ticket-create' },
    );
    return true;
  }

  requestAuthenticatedWrite(
    target,
    'POST',
    '/api/reports',
    actor,
    {
      targetType: 'PROFILE',
      targetId: actor.targetUserId,
      reason: 'OTHER',
      detail: 'stress report detail',
      evidenceAttachmentIds: [],
      falseReportDisclaimerAccepted: true,
    },
    { ...writeTags, endpoint: 'report-create' },
  );
  return true;
}

export function pause(defaultSeconds = 1) {
  const seconds = Number.parseFloat(__ENV.STRESS_SLEEP_SECONDS || String(defaultSeconds));
  sleep(Number.isFinite(seconds) && seconds >= 0 ? seconds : defaultSeconds);
}

export function buildParams(tags = {}, expectedStatuses = [200, 201, 202, 204, 304]) {
  return {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'knu-roommate-k6-stress',
    },
    responseCallback: http.expectedStatuses(...expectedStatuses),
    tags,
    timeout: __ENV.STRESS_REQUEST_TIMEOUT || '10s',
  };
}

function buildAuthenticatedParams(
  actor,
  tags = {},
  expectedStatuses = AUTH_READ_EXPECTED_STATUSES,
) {
  const params = buildParams(tags, expectedStatuses);
  params.headers.Authorization = `Bearer ${actor.accessToken}`;
  return params;
}

function buildAuthenticatedJsonParams(
  actor,
  tags = {},
  expectedStatuses = AUTH_WRITE_EXPECTED_STATUSES,
) {
  const params = buildAuthenticatedParams(actor, tags, expectedStatuses);
  params.headers['Content-Type'] = 'application/json';
  return params;
}

function requestRead(target, path, tags) {
  const response = http.get(
    `${target.baseUrl}${path}`,
    buildParams(tags, PUBLIC_READ_EXPECTED_STATUSES),
  );

  check(response, {
    'read status is not 5xx': (res) => res.status < 500,
    'read status is expected': (res) => [200, 204, 404].includes(res.status),
  });

  return response;
}

function requestAuthenticatedRead(target, path, actor, tags) {
  const response = http.get(
    `${target.baseUrl}${path}`,
    buildAuthenticatedParams(actor, tags, AUTH_READ_EXPECTED_STATUSES),
  );

  check(response, {
    'authenticated read does not return 5xx': (res) => res.status < 500,
    'authenticated read is authorized or domain-valid': (res) =>
      [200, 204, 400, 401, 403, 404].includes(res.status),
  });

  return response;
}

function requestAuthenticatedWrite(target, method, path, actor, body, tags) {
  const url = `${target.baseUrl}${path}`;
  const payload = body === null ? null : JSON.stringify(body);
  const params =
    body === null
      ? buildAuthenticatedParams(actor, tags, AUTH_WRITE_EXPECTED_STATUSES)
      : buildAuthenticatedJsonParams(actor, tags, AUTH_WRITE_EXPECTED_STATUSES);
  const response = http.request(method, url, payload, params);

  check(response, {
    'write status does not return 5xx': (res) => res.status < 500,
    'write status is accepted or domain-valid': (res) =>
      [200, 201, 204, 400, 401, 403, 404, 409, 422, 429].includes(res.status),
  });

  return response;
}

function loadActorTokenArtifact() {
  if (__ENV.STRESS_ACTOR_TOKENS_PATH) {
    const artifact = JSON.parse(open(__ENV.STRESS_ACTOR_TOKENS_PATH));
    return Array.isArray(artifact.actors) ? artifact.actors : [];
  }

  if (__ENV.STRESS_ACCESS_TOKEN) {
    return [
      {
        actorId: 'single-env-token',
        role: 'search-reader',
        userId: 'unknown',
        participantId: 'unknown',
        targetUserId: __ENV.STRESS_TARGET_USER_ID || 'unknown',
        targetParticipantId: __ENV.STRESS_TARGET_PARTICIPANT_ID || 'unknown',
        threadId: __ENV.STRESS_THREAD_ID || null,
        accessToken: __ENV.STRESS_ACCESS_TOKEN,
      },
    ];
  }

  return [];
}

function pickActorToken() {
  if (!actorTokenArtifact.length) {
    return null;
  }

  const index = Math.abs((__VU || 1) + (__ITER || 0)) % actorTokenArtifact.length;
  return actorTokenArtifact[index];
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
