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
    'score-cohort-946': {
      executor: 'constant-vus',
      vus: Number(__ENV.STRESS_SCORE_COHORT_VUS || 237),
      duration: __ENV.STRESS_SCORE_COHORT_DURATION || '10m',
      gracefulStop: '45s',
    },
  },
  thresholds: {
    'http_req_failed{scenario:score-cohort-946}': ['rate<0.02'],
    'http_req_duration{scenario:score-cohort-946}': ['p(95)<800', 'p(99)<1800'],
    'http_req_duration{scenario:score-cohort-946,endpoint:roommate-search}': [
      'p(95)<800',
      'p(99)<1800',
    ],
    'checks{scenario:score-cohort-946}': ['rate>0.97'],
  },
};

export default function scoreCohortScenario() {
  readPublicApiMix(target, { profile: 'score-cohort-946', cohort: '946' });
  readOptionalAuthenticatedMix(target, { profile: 'score-cohort-946', cohort: '946' });
  maybeRunWriteMix(target, { profile: 'score-cohort-946', cohort: '946' });
  pause(1);
}
