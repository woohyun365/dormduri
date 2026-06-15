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
    'baseline-250': {
      executor: 'constant-vus',
      vus: Number(__ENV.STRESS_BASELINE_VUS || 250),
      duration: __ENV.STRESS_BASELINE_DURATION || '10m',
      gracefulStop: '30s',
    },
  },
  thresholds: {
    'http_req_failed{scenario:baseline-250}': ['rate<0.01'],
    'http_req_duration{scenario:baseline-250}': ['p(95)<350', 'p(99)<1000'],
    'http_req_duration{scenario:baseline-250,endpoint:roommate-search}': [
      'p(95)<700',
      'p(99)<1500',
    ],
    'checks{scenario:baseline-250}': ['rate>0.98'],
  },
};

export default function baselineScenario() {
  readPublicApiMix(target, { profile: 'baseline-250' });
  readOptionalAuthenticatedMix(target, { profile: 'baseline-250' });
  maybeRunWriteMix({ profile: 'baseline-250' });
  pause(1);
}
