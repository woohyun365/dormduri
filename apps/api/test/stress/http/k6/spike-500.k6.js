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
    'spike-500': {
      executor: 'ramping-vus',
      stages: [
        {
          duration: __ENV.STRESS_SPIKE_RAMP_UP || '1m',
          target: Number(__ENV.STRESS_SPIKE_VUS || 500),
        },
        {
          duration: __ENV.STRESS_SPIKE_HOLD || '2m',
          target: Number(__ENV.STRESS_SPIKE_VUS || 500),
        },
        { duration: __ENV.STRESS_SPIKE_RAMP_DOWN || '2m', target: 0 },
        { duration: __ENV.STRESS_SPIKE_RECOVERY || '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_failed{scenario:spike-500}': ['rate<0.02'],
    'http_req_duration{scenario:spike-500}': ['p(95)<800', 'p(99)<2000'],
    'checks{scenario:spike-500}': ['rate>0.97'],
  },
};

export default function spikeScenario() {
  readPublicApiMix(target, { profile: 'spike-500' });
  readOptionalAuthenticatedMix(target, { profile: 'spike-500' });
  maybeRunWriteMix(target, { profile: 'spike-500' });
  pause(1);
}
