export type ArtilleryRealtimeScenarioName = 'smoke' | 'baseline-250' | 'peak-500';

export interface ArtilleryRealtimeScenarioDefinition {
  readonly name: ArtilleryRealtimeScenarioName;
  readonly scriptFile: `${ArtilleryRealtimeScenarioName}.yml`;
  readonly defaultDurationSeconds: number;
  readonly arrivalRate: number;
  readonly maxSockets: number;
  readonly targetProfile: 'local' | 'staging';
  readonly flow: readonly string[];
  readonly metricKeys: readonly string[];
  readonly summary: string;
}

export const ARTILLERY_REALTIME_SCENARIOS: readonly ArtilleryRealtimeScenarioDefinition[] = [
  {
    name: 'smoke',
    scriptFile: 'smoke.yml',
    defaultDurationSeconds: 1,
    arrivalRate: 1,
    maxSockets: 2,
    targetProfile: 'local',
    flow: [
      'ticket-issue',
      'socket-connect',
      'thread-subscribe',
      'thread-unsubscribe',
      'disconnect',
    ],
    metricKeys: [
      'vusers.created',
      'vusers.completed',
      'vusers.failed',
      'socketio.emit',
      'socketio.response_time',
    ],
    summary:
      'local/staging target에서 realtime ticket issue와 /chat subscribe ack 생존성을 확인한다.',
  },
  {
    name: 'baseline-250',
    scriptFile: 'baseline-250.yml',
    defaultDurationSeconds: 300,
    arrivalRate: 25,
    maxSockets: 250,
    targetProfile: 'staging',
    flow: ['ticket-issue', 'socket-connect', 'thread-subscribe', 'steady-listen', 'disconnect'],
    metricKeys: [
      'vusers.created',
      'vusers.completed',
      'vusers.failed',
      'socketio.emit',
      'socketio.response_time',
    ],
    summary:
      '250 socket equivalent steady state에서 subscribe ack latency와 failure budget을 검증한다.',
  },
  {
    name: 'peak-500',
    scriptFile: 'peak-500.yml',
    defaultDurationSeconds: 420,
    arrivalRate: 40,
    maxSockets: 500,
    targetProfile: 'staging',
    flow: [
      'ticket-issue',
      'socket-connect',
      'thread-subscribe',
      'disconnect-reconnect',
      'thread-unsubscribe',
    ],
    metricKeys: [
      'vusers.created',
      'vusers.completed',
      'vusers.failed',
      'socketio.emit',
      'socketio.response_time',
    ],
    summary: '500 socket peak/ramp에서 connection churn과 reconnect failure budget을 검증한다.',
  },
];

export function getArtilleryRealtimeScenarioDefinition(name: ArtilleryRealtimeScenarioName) {
  const definition = ARTILLERY_REALTIME_SCENARIOS.find((scenario) => scenario.name === name);

  if (!definition) {
    throw new Error(`Unknown Artillery realtime stress scenario: ${name}`);
  }

  return definition;
}
