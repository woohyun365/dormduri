import http from 'k6/http';
import { check } from 'k6';
import { assertStressTargetAllowed, buildParams, pause } from './common.js';

const scenario = 'auth-login-capacity';
const target = assertStressTargetAllowed();
const actorCount = positiveInteger(__ENV.STRESS_AUTH_ACTOR_COUNT, 25);
const vus = positiveInteger(__ENV.STRESS_AUTH_LOGIN_VUS, 10);

export const options = {
  scenarios: {
    [scenario]: {
      executor: 'constant-vus',
      vus,
      duration: __ENV.STRESS_AUTH_LOGIN_DURATION || '2m',
      gracefulStop: '10s',
      tags: { scenario },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    [`http_req_duration{scenario:${scenario}}`]: ['p(95)<1500', 'p(99)<3000'],
    [`checks{scenario:${scenario}}`]: ['rate>0.99'],
  },
};

export default function () {
  const actorIndex = ((__VU - 1) % actorCount) + 1;
  const targetKind = (__ITER + __VU) % 2 === 0 ? 'real' : 'dummy';
  const paddedActorIndex = String(actorIndex).padStart(4, '0');
  const prefix = __ENV.STRESS_FIXTURE_PREFIX || 'stress-local';
  const email =
    targetKind === 'real'
      ? `${prefix}+${paddedActorIndex}@stress.example.invalid`
      : `${prefix}+missing-${paddedActorIndex}@stress.example.invalid`;
  const password =
    targetKind === 'real'
      ? `${prefix}-password-${paddedActorIndex}`
      : `${prefix}-unavailable-password-${paddedActorIndex}`;
  const forwardedFor = `10.238.${Math.floor(actorIndex / 250)}.${(actorIndex % 250) + 1}`;
  const params = buildParams({ scenario, endpoint: 'auth-login', target: targetKind }, [200, 429]);
  params.headers['Content-Type'] = 'application/json';
  params.headers['X-Forwarded-For'] = forwardedFor;

  const response = http.post(
    `${target.baseUrl}/auth/login`,
    JSON.stringify({ email, password, rememberMe: false }),
    params,
  );
  let body = null;
  try {
    body = response.json();
  } catch {
    body = null;
  }

  check(
    response,
    {
      'auth login capacity status is 200': (result) => result.status === 200,
      'auth login capacity result matches target': () =>
        targetKind === 'real' ? body?.success === true : body?.success === false,
      'auth login capacity response does not expose password': (result) =>
        !String(result.body || '').includes(password),
    },
    { scenario, target: targetKind },
  );

  pause(0.2);
}

function positiveInteger(input, fallback) {
  const parsed = Number.parseInt(String(input || fallback), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
