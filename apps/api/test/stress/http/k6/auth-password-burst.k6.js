import http from 'k6/http';
import { check, fail } from 'k6';
import exec from 'k6/execution';
import { assertStressTargetAllowed, buildParams } from './common.js';

const scenario = 'auth-password-burst';
const target = assertStressTargetAllowed();
const profile = String(__ENV.STRESS_AUTH_CAPACITY_PROFILE || 'h1').toLowerCase();
const artifact = loadCapacityArtifact();

export const options = {
  scenarios: buildScenarios(profile),
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    [`http_req_duration{scenario:${scenario}}`]: [
      profile === 'h5' ? 'p(95)<3000' : 'p(95)<1500',
      profile === 'h5' ? 'p(99)<5000' : 'p(99)<3000',
    ],
    [`checks{scenario:${scenario}}`]: ['rate>0.99'],
    ...operationThresholds(profile),
  },
};

export function authTraffic() {
  const iteration = exec.scenario.iterationInTest;
  const operation = selectOperation(profile, iteration);
  const requestIp = capacityRequestIp(iteration, operation);

  switch (operation) {
    case 'login_success':
      runLogin(
        pickReusable(artifact.loginSuccess, iteration, operation),
        true,
        requestIp,
        operation,
      );
      return;
    case 'login_failure':
      runLogin(pickLoginFailure(artifact.loginFailure, iteration), false, requestIp, operation);
      return;
    case 'signup':
      runSignup(
        pickSingleUse(artifact.signup, singleUseOrdinal(profile, iteration, operation)),
        requestIp,
      );
      return;
    case 'reset_password':
      runReset(
        pickSingleUse(artifact.reset, singleUseOrdinal(profile, iteration, operation)),
        requestIp,
      );
      return;
    case 'change_password':
      runChange(
        pickSingleUse(artifact.change, singleUseOrdinal(profile, iteration, operation)),
        requestIp,
      );
      return;
    default:
      fail(`Unsupported auth password capacity operation: ${operation}`);
  }
}

export default authTraffic;

export function roommateReadTraffic() {
  const iteration = exec.scenario.iterationInTest;
  const entry = pickReusable(artifact.readTraffic, iteration, 'roommate_read');
  const operation = 'roommate_read';
  const params = buildParams(tags(operation), [200]);
  params.headers = {
    ...params.headers,
    Authorization: `Bearer ${entry.accessToken}`,
  };
  const response = http.get(
    `${target.baseUrl}/api/roommate-search?scope=SAME_BUILDING_ONLY&limit=20&sort=MATCH_SCORE`,
    params,
  );

  check(
    response,
    {
      'roommate read status is 200': (result) => result.status === 200,
      'roommate read response is token-free': (result) =>
        responseOmitsSecrets(result, [entry.accessToken]),
    },
    tags(operation),
  );
}

function runLogin(entry, expectedSuccess, requestIp, operation) {
  const expectedStatuses = profile === 'h9' ? [200, 429] : [200];
  const response = postJson(
    '/auth/login',
    { email: entry.email, password: entry.password, rememberMe: false },
    requestHeaders(requestIp, operation),
    expectedStatuses,
  );
  const body = safeJson(response);
  const expectedOutcome =
    profile === 'h9'
      ? response.status === 429 || (response.status === 200 && body?.success === false)
      : response.status === 200 && body?.success === expectedSuccess;

  check(
    response,
    {
      [`${operation} status is expected`]: (result) => expectedStatuses.includes(result.status),
      [`${operation} result matches fixture`]: () => expectedOutcome,
      [`${operation} response is secret-free`]: (result) =>
        responseOmitsSecrets(result, [entry.password]),
    },
    tags(operation),
  );
}

function runSignup(entry, requestIp) {
  const response = postJson(
    '/auth/signup',
    {
      email: entry.email,
      password: entry.password,
      nickname: entry.nickname,
      gender: 'M',
      campus: 'CHUNCHEON',
      collegeCode: 'CHUNCHEON_ARTS_ENGINEERING',
      birthYear: 2002,
      legalAcceptances: artifact.legalAcceptances,
    },
    requestHeaders(requestIp, 'signup', entry.verificationGrant),
    [201],
  );
  const body = safeJson(response);

  check(
    response,
    {
      'signup status is 201': (result) => result.status === 201,
      'signup commits account and session': () =>
        body?.success === true && typeof body?.accessToken === 'string',
      'signup response is secret-free': (result) =>
        responseOmitsSecrets(result, [entry.password, entry.verificationGrant]),
    },
    tags('signup'),
  );
}

function runReset(entry, requestIp) {
  const response = postJson(
    '/auth/reset-password',
    { newPassword: entry.newPassword },
    requestHeaders(requestIp, 'reset_password', entry.verificationGrant),
    [201],
  );
  const body = safeJson(response);

  check(
    response,
    {
      'reset status is 201': (result) => result.status === 201,
      'reset commits credential lifecycle': () => body?.success === true,
      'reset response is secret-free': (result) =>
        responseOmitsSecrets(result, [entry.newPassword, entry.verificationGrant]),
    },
    tags('reset_password'),
  );
}

function runChange(entry, requestIp) {
  const response = postJson(
    '/auth/change-password',
    { currentPassword: entry.currentPassword, newPassword: entry.newPassword },
    requestHeaders(requestIp, 'change_password', null, entry.accessToken),
    [200],
  );
  const body = safeJson(response);

  check(
    response,
    {
      'change status is 200': (result) => result.status === 200,
      'change commits replacement session': () =>
        body?.success === true && typeof body?.accessToken === 'string',
      'change response is secret-free': (result) =>
        responseOmitsSecrets(result, [entry.currentPassword, entry.newPassword, entry.accessToken]),
    },
    tags('change_password'),
  );
}

function postJson(path, body, headers, expectedStatuses) {
  const params = buildParams(headers.tags, expectedStatuses);
  params.headers = { ...params.headers, ...headers.values, 'Content-Type': 'application/json' };
  return http.post(`${target.baseUrl}${path}`, JSON.stringify(body), params);
}

function requestHeaders(requestIp, operation, verificationGrant = null, accessToken = null) {
  const values = { 'X-Forwarded-For': requestIp };
  if (verificationGrant) {
    values['X-Auth-Verification-Grant'] = verificationGrant;
  }
  if (accessToken) {
    values.Authorization = `Bearer ${accessToken}`;
  }
  return { values, tags: tags(operation) };
}

function tags(operation) {
  return { scenario, profile, operation };
}

function selectOperation(selectedProfile, iteration) {
  if (__ENV.STRESS_AUTH_CAPACITY_SMOKE_MIX === 'true' && iteration < 5) {
    return ['login_success', 'login_failure', 'signup', 'reset_password', 'change_password'][
      iteration
    ];
  }
  if (__ENV.STRESS_AUTH_CAPACITY_SMOKE_MIX === 'true') {
    return 'login_success';
  }
  if (selectedProfile === 'h6') {
    return iteration % 3 === 0 ? 'signup' : 'login_success';
  }
  if (selectedProfile === 'h7' || selectedProfile === 'h8') {
    return 'login_success';
  }
  if (selectedProfile === 'h9') {
    return 'login_failure';
  }

  const slot = iteration % 200;
  if (slot < 160) return 'login_success';
  if (slot < 190) return 'login_failure';
  if (slot < 196) return 'signup';
  if (slot < 199) return 'reset_password';
  return 'change_password';
}

function singleUseOrdinal(selectedProfile, iteration, operation) {
  if (__ENV.STRESS_AUTH_CAPACITY_SMOKE_MIX === 'true') {
    return 0;
  }
  if (selectedProfile === 'h6' && operation === 'signup') {
    return Math.floor(iteration / 3);
  }

  const cycle = Math.floor(iteration / 200);
  const slot = iteration % 200;
  if (operation === 'signup') return cycle * 6 + (slot - 190);
  if (operation === 'reset_password') return cycle * 3 + (slot - 196);
  if (operation === 'change_password') return cycle;
  return iteration;
}

function buildScenarios(selectedProfile) {
  const overrideDuration = __ENV.STRESS_AUTH_CAPACITY_DURATION;
  const overrideRate = positiveNumber(__ENV.STRESS_AUTH_CAPACITY_RATE, null);
  if (overrideDuration && overrideRate) {
    return {
      [scenario]: constantArrivalRate(overrideRate, overrideDuration, '0s'),
    };
  }

  switch (selectedProfile) {
    case 'h1':
      return { [scenario]: constantArrivalRate(1, '10m', '0s') };
    case 'h2':
      return { [scenario]: constantArrivalRate(2, '10m', '0s') };
    case 'h3':
      return {
        [scenario]: constantArrivalRate(5, '10m', '0s'),
        [`${scenario}-roommate-read`]: constantArrivalRate(5, '10m', '0s', 'roommateReadTraffic'),
      };
    case 'h4':
      return { [scenario]: constantArrivalRate(10, '5m', '0s') };
    case 'h5':
      return {
        [scenario]: {
          executor: 'ramping-arrival-rate',
          startRate: 20,
          timeUnit: '1s',
          preAllocatedVUs: 40,
          maxVUs: 100,
          stages: [
            { target: 20, duration: '30s' },
            { target: 2, duration: '1s' },
            { target: 2, duration: '5m' },
          ],
          gracefulStop: '10s',
          tags: { scenario, profile: selectedProfile },
        },
      };
    case 'h6':
      return { [scenario]: constantArrivalRate(3, '5m', '0s') };
    case 'h7':
      return {
        [`${scenario}-2rps`]: constantArrivalRate(2, '5m', '0s'),
        [`${scenario}-5rps`]: constantArrivalRate(5, '5m', '5m10s'),
      };
    case 'h8': {
      const scenarios = {
        [`${scenario}-soak`]: constantArrivalRate(2, '60m', '0s'),
      };
      for (let index = 1; index <= 11; index += 1) {
        scenarios[`${scenario}-burst-${index}`] = constantArrivalRate(5, '30s', `${index * 5}m`);
      }
      return scenarios;
    }
    case 'h9':
      return { [scenario]: constantArrivalRate(5, '2m', '0s') };
    default:
      fail(`Unknown STRESS_AUTH_CAPACITY_PROFILE: ${selectedProfile}`);
  }
}

function operationThresholds(selectedProfile) {
  const safetySpike = selectedProfile === 'h5';
  const headroom = selectedProfile === 'h4';
  const latency = {
    login_success: safetySpike ? [3000, 5000] : headroom ? [1000, 2000] : [750, 1500],
    login_failure: safetySpike ? [3000, 5000] : headroom ? [1000, 2000] : [750, 1500],
    signup: safetySpike ? [3000, 5000] : headroom ? [1250, 2500] : [1000, 2000],
    reset_password: safetySpike ? [3000, 5000] : headroom ? [1500, 3000] : [1250, 2500],
    change_password: safetySpike ? [3000, 5000] : headroom ? [1500, 3000] : [1250, 2500],
    roommate_read: [500, 1500],
  };
  return Object.fromEntries(
    Object.entries(latency).flatMap(([operation, [p95, p99]]) => [
      [`http_req_duration{operation:${operation}}`, [`p(95)<${p95}`, `p(99)<${p99}`]],
      [`http_req_failed{operation:${operation}}`, ['rate<0.01']],
    ]),
  );
}

function constantArrivalRate(rate, duration, startTime, execName = 'authTraffic') {
  return {
    executor: 'constant-arrival-rate',
    rate,
    timeUnit: '1s',
    duration,
    startTime,
    preAllocatedVUs: Math.max(10, rate * 2),
    maxVUs: Math.max(40, rate * 5),
    gracefulStop: '10s',
    exec: execName,
    tags: { scenario, profile },
  };
}

function capacityRequestIp(iteration, operation) {
  if (profile === 'h9' && iteration % 2 === 0) {
    return '10.239.0.10';
  }
  const seed = Math.abs(iteration + operation.length * 997);
  return `10.239.${Math.floor(seed / 250) % 250}.${(seed % 250) + 1}`;
}

function pickReusable(entries, iteration, operation) {
  if (!Array.isArray(entries) || entries.length === 0) {
    fail(`Capacity artifact has no ${operation} entries.`);
  }
  return entries[iteration % entries.length];
}

function pickLoginFailure(entries, iteration) {
  if (profile === 'h9' && iteration % 2 === 0) {
    return pickReusable(entries, 0, 'login_failure');
  }
  return pickReusable(entries, iteration, 'login_failure');
}

function pickSingleUse(entries, ordinal) {
  if (!Array.isArray(entries) || ordinal < 0 || ordinal >= entries.length) {
    fail(`Capacity artifact single-use pool exhausted at ordinal ${ordinal}.`);
  }
  return entries[ordinal];
}

function responseOmitsSecrets(response, secrets) {
  const body = String(response.body || '');
  return secrets.filter(Boolean).every((secret) => !body.includes(String(secret)));
}

function safeJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

function loadCapacityArtifact() {
  const artifactPath = __ENV.STRESS_AUTH_CAPACITY_ARTIFACT_PATH;
  if (!artifactPath) {
    throw new Error('STRESS_AUTH_CAPACITY_ARTIFACT_PATH is required.');
  }
  const parsed = JSON.parse(open(artifactPath));
  if (parsed?.schemaVersion !== 1) {
    throw new Error('Unsupported auth password capacity artifact schema.');
  }
  return parsed;
}

function positiveNumber(input, fallback) {
  const parsed = Number.parseFloat(String(input || ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
