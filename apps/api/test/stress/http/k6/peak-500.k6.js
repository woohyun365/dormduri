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
    'peak-500': {
      executor: 'constant-vus',
      vus: Number(__ENV.STRESS_PEAK_VUS || 500),
      duration: __ENV.STRESS_PEAK_DURATION || '15m',
      gracefulStop: '45s',
    },
  },
  thresholds: {
    'http_req_failed{scenario:peak-500}': ['rate<0.02'],
    'http_req_duration{scenario:peak-500}': ['p(95)<500', 'p(99)<1400'],
    'http_req_duration{scenario:peak-500,endpoint:roommate-search}': ['p(95)<900', 'p(99)<1800'],
    'checks{scenario:peak-500}': ['rate>0.97'],
  },
};

export default function peakScenario() {
  readPublicApiMix(target, { profile: 'peak-500' });
  readOptionalAuthenticatedMix(target, { profile: 'peak-500' });
  maybeRunWriteMix(target, { profile: 'peak-500' });
  pause(1);
}
