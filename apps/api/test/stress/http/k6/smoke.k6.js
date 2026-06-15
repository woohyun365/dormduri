import { assertStressTargetAllowed, maybeRunWriteMix, pause, readPublicApiMix } from './common.js';

const target = assertStressTargetAllowed();

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: Number(__ENV.STRESS_SMOKE_VUS || 5),
      duration: __ENV.STRESS_SMOKE_DURATION || '1m',
      gracefulStop: '15s',
    },
  },
  thresholds: {
    'http_req_failed{scenario:smoke}': ['rate<0.01'],
    'http_req_duration{scenario:smoke,endpoint:health}': ['p(95)<300', 'p(99)<800'],
    'http_req_duration{scenario:smoke,endpoint:readiness}': ['p(95)<500', 'p(99)<1000'],
    'checks{scenario:smoke}': ['rate>0.99'],
  },
};

export default function smokeScenario() {
  readPublicApiMix(target, { profile: 'smoke' });
  maybeRunWriteMix({ profile: 'smoke' });
  pause(1);
}
