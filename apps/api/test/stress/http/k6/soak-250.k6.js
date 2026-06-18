import {
  assertStressTargetAllowed,
  maybeRunWriteMix,
  pause,
  readOptionalAuthenticatedMix,
  readPublicApiMix,
} from './common.js';

const target = assertStressTargetAllowed();

export const options = {
  scenarios: {
    'soak-250': {
      executor: 'constant-vus',
      vus: Number(__ENV.STRESS_SOAK_VUS || 250),
      duration: __ENV.STRESS_SOAK_DURATION || '30m',
      gracefulStop: '1m',
    },
  },
  thresholds: {
    'http_req_failed{scenario:soak-250}': ['rate<0.005'],
    'http_req_duration{scenario:soak-250}': ['p(95)<500', 'p(99)<1400'],
    'checks{scenario:soak-250}': ['rate>0.985'],
  },
};

export default function soakScenario() {
  readPublicApiMix(target, { profile: 'soak-250' });
  readOptionalAuthenticatedMix(target, { profile: 'soak-250' });
  maybeRunWriteMix(target, { profile: 'soak-250' });
  pause(1);
}
