import http from 'k6/http';
import { check } from 'k6';
import { assertStressTargetAllowed, buildParams, pause } from './common.js';

const scenario = 'auth-recovery-abuse';
const target = assertStressTargetAllowed();
const rate = positiveInteger(__ENV.STRESS_AUTH_RECOVERY_RATE, 2);

export const options = {
  scenarios: {
    [scenario]: {
      executor: 'constant-arrival-rate',
      rate,
      timeUnit: '1s',
      duration: __ENV.STRESS_AUTH_RECOVERY_DURATION || '2m',
      preAllocatedVUs: Math.max(5, rate * 2),
      maxVUs: Math.max(20, rate * 5),
      gracefulStop: '10s',
      tags: { scenario },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    [`http_req_duration{scenario:${scenario}}`]: ['p(95)<1200', 'p(99)<2000'],
    [`checks{scenario:${scenario}}`]: ['rate>0.99'],
  },
};

export default function () {
  const actorIndex = ((__ITER + __VU) % 500) + 1;
  const scopeIndex = (__ITER + __VU) % 3;
  const scope =
    scopeIndex === 0 ? 'same-subject' : scopeIndex === 1 ? 'campus-nat' : 'distributed-subject';
  const email =
    scope === 'same-subject'
      ? 'stress-recovery-shared@kangwon.ac.kr'
      : `stress-recovery-${String(actorIndex).padStart(4, '0')}@kangwon.ac.kr`;
  const requestIp =
    scope === 'same-subject'
      ? '10.239.0.10'
      : scope === 'campus-nat'
        ? '10.239.1.10'
        : `10.239.${Math.floor(actorIndex / 250) + 2}.${(actorIndex % 250) + 1}`;
  const verifyOperation = (__ITER + __VU) % 2 === 1;
  const endpoint = verifyOperation ? 'verify-reset-code' : 'send-reset-code';
  const body = verifyOperation ? { email, code: '000000' } : { email };
  const params = buildParams({ scenario, endpoint, scope }, [200, 201, 429]);
  params.headers['Content-Type'] = 'application/json';
  params.headers['X-Forwarded-For'] = requestIp;

  const response = http.post(`${target.baseUrl}/auth/${endpoint}`, JSON.stringify(body), params);

  check(
    response,
    {
      'auth recovery abuse status is bounded': (result) => [200, 201, 429].includes(result.status),
      'auth recovery abuse does not return 5xx': (result) => result.status < 500,
      'campus NAT traffic is not throttled at the release rate': (result) =>
        scope !== 'campus-nat' || result.status !== 429,
      'auth recovery response does not expose subject': (result) =>
        !String(result.body || '').includes(email),
      'auth recovery response does not expose submitted code': (result) =>
        !String(result.body || '').includes('000000'),
    },
    { scenario, endpoint, scope },
  );

  pause(0.1);
}

function positiveInteger(input, fallback) {
  const parsed = Number.parseInt(String(input || fallback), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
