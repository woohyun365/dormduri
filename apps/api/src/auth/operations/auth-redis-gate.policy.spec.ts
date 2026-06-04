import { evaluateAuthRedisGate } from './auth-redis-gate.policy.js';

const settings = {
  authP95MsThreshold: 250,
  authWriteIopsThreshold: 100,
  throttleBypassPerHourThreshold: 1,
  degradeMode: 'postgres-local-fallback-alert',
};

describe('evaluateAuthRedisGate', () => {
  it('관측 trigger가 없으면 Postgres authoritative를 유지하고 Redis source-of-truth를 금지한다', () => {
    expect(
      evaluateAuthRedisGate(
        {
          authP95Ms: 120,
          authWriteIops: 40,
          throttleBypassPerHour: 0,
        },
        settings,
      ),
    ).toEqual({
      decision: 'postgres_authoritative',
      triggers: [],
      sourceOfTruth: 'postgres',
      redisOwns: ['distributed_throttle', 'hot_session_cache'],
      redisMustNotOwn: ['session_authority', 'verification_authority', 'account_lockout_authority'],
      degradeMode: 'postgres-local-fallback-alert',
    });
  });

  it('multi-instance throttle 우회, RDS auth write IOPS, p95 병목이 관측될 때만 Redis 후보로 승격한다', () => {
    expect(
      evaluateAuthRedisGate(
        {
          authP95Ms: 250,
          authWriteIops: 100,
          throttleBypassPerHour: 1,
        },
        settings,
      ),
    ).toMatchObject({
      decision: 'redis_candidate',
      triggers: ['multi_instance_throttle_bypass', 'rds_auth_write_iops', 'auth_p95_latency'],
      sourceOfTruth: 'postgres',
      degradeMode: 'postgres-local-fallback-alert',
    });
  });
});
