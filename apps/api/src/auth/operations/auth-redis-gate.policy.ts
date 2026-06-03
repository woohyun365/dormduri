export type AuthRedisGateTrigger =
  | 'multi_instance_throttle_bypass'
  | 'rds_auth_write_iops'
  | 'auth_p95_latency';

export type AuthRedisGateDecision = 'postgres_authoritative' | 'redis_candidate';

export interface AuthRedisGateSettings {
  authP95MsThreshold: number;
  authWriteIopsThreshold: number;
  throttleBypassPerHourThreshold: number;
  degradeMode: string;
}

export interface AuthRedisGateSignals {
  authP95Ms?: number | null;
  authWriteIops?: number | null;
  throttleBypassPerHour?: number | null;
}

export interface AuthRedisGateEvaluation {
  decision: AuthRedisGateDecision;
  triggers: AuthRedisGateTrigger[];
  sourceOfTruth: 'postgres';
  redisOwns: Array<'distributed_throttle' | 'hot_session_cache'>;
  redisMustNotOwn: Array<
    'session_authority' | 'verification_authority' | 'account_lockout_authority'
  >;
  degradeMode: string;
}

export function evaluateAuthRedisGate(
  signals: AuthRedisGateSignals,
  settings: AuthRedisGateSettings,
): AuthRedisGateEvaluation {
  const triggers: AuthRedisGateTrigger[] = [];

  if ((signals.throttleBypassPerHour ?? 0) >= settings.throttleBypassPerHourThreshold) {
    triggers.push('multi_instance_throttle_bypass');
  }

  if ((signals.authWriteIops ?? 0) >= settings.authWriteIopsThreshold) {
    triggers.push('rds_auth_write_iops');
  }

  if ((signals.authP95Ms ?? 0) >= settings.authP95MsThreshold) {
    triggers.push('auth_p95_latency');
  }

  return {
    decision: triggers.length > 0 ? 'redis_candidate' : 'postgres_authoritative',
    triggers,
    sourceOfTruth: 'postgres',
    redisOwns: ['distributed_throttle', 'hot_session_cache'],
    redisMustNotOwn: ['session_authority', 'verification_authority', 'account_lockout_authority'],
    degradeMode: settings.degradeMode,
  };
}
