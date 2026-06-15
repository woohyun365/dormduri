export type K6HttpScenarioName =
  | 'smoke'
  | 'baseline-250'
  | 'peak-500'
  | 'spike-500'
  | 'soak-250'
  | 'score-cohort-946';

export interface K6HttpScenarioDefinition {
  readonly name: K6HttpScenarioName;
  readonly scriptFile: `${K6HttpScenarioName}.k6.js`;
  readonly defaultDuration: string;
  readonly maxVus: number;
  readonly targetProfile: 'local' | 'staging';
  readonly requestMix: readonly string[];
  readonly thresholdKeys: readonly string[];
  readonly summary: string;
}

export const K6_HTTP_SCENARIOS: readonly K6HttpScenarioDefinition[] = [
  {
    name: 'smoke',
    scriptFile: 'smoke.k6.js',
    defaultDuration: '1m',
    maxVus: 20,
    targetProfile: 'local',
    requestMix: ['health', 'readiness', 'current-season'],
    thresholdKeys: ['http_req_failed', 'http_req_duration', 'checks'],
    summary: 'local/staging target과 공개 read endpoint의 최소 생존성을 확인한다.',
  },
  {
    name: 'baseline-250',
    scriptFile: 'baseline-250.k6.js',
    defaultDuration: '10m',
    maxVus: 250,
    targetProfile: 'staging',
    requestMix: ['health', 'readiness', 'current-season', 'optional-authenticated-read'],
    thresholdKeys: ['http_req_failed', 'http_req_duration', 'checks'],
    summary: '250 concurrent equivalent read 중심 baseline을 검증한다.',
  },
  {
    name: 'peak-500',
    scriptFile: 'peak-500.k6.js',
    defaultDuration: '15m',
    maxVus: 500,
    targetProfile: 'staging',
    requestMix: ['health', 'readiness', 'current-season', 'optional-authenticated-read'],
    thresholdKeys: ['http_req_failed', 'http_req_duration', 'checks'],
    summary: '500 concurrent equivalent 피크에서 read latency와 error budget을 검증한다.',
  },
  {
    name: 'spike-500',
    scriptFile: 'spike-500.k6.js',
    defaultDuration: '6m',
    maxVus: 500,
    targetProfile: 'staging',
    requestMix: ['health', 'readiness', 'current-season', 'optional-authenticated-read'],
    thresholdKeys: ['http_req_failed', 'http_req_duration', 'checks'],
    summary: '0→500 ramp-up/recovery 동안 crash 없이 회복 가능한지 검증한다.',
  },
  {
    name: 'soak-250',
    scriptFile: 'soak-250.k6.js',
    defaultDuration: '30m',
    maxVus: 250,
    targetProfile: 'staging',
    requestMix: ['health', 'readiness', 'current-season', 'optional-authenticated-read'],
    thresholdKeys: ['http_req_failed', 'http_req_duration', 'checks'],
    summary: '250 steady 장시간 구간에서 지속 error/latency 악화를 관찰한다.',
  },
  {
    name: 'score-cohort-946',
    scriptFile: 'score-cohort-946.k6.js',
    defaultDuration: '10m',
    maxVus: 946,
    targetProfile: 'staging',
    requestMix: ['health', 'current-season', 'optional-roommate-search-score'],
    thresholdKeys: ['http_req_failed', 'http_req_duration', 'checks'],
    summary: '946명 same-dorm/gender score cohort 검색/read path를 검증한다.',
  },
];

export function getK6HttpScenarioDefinition(name: K6HttpScenarioName) {
  const definition = K6_HTTP_SCENARIOS.find((scenario) => scenario.name === name);

  if (!definition) {
    throw new Error(`Unknown k6 HTTP stress scenario: ${name}`);
  }

  return definition;
}
