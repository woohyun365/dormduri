import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { STRESS_PRODUCTION_OVERRIDE_VALUE } from '../../safety/stress-target.guard.js';
import { K6_HTTP_SCENARIOS } from './k6-http-scenarios.js';

const k6Root = join(process.cwd(), 'test/stress/http/k6');

function readK6Script(fileName: string) {
  return readFileSync(join(k6Root, fileName), 'utf8');
}

describe('k6 HTTP stress scripts static contract', () => {
  it('release matrix의 모든 HTTP scenario script가 존재하고 k6 runtime import만 사용한다', () => {
    for (const scenario of K6_HTTP_SCENARIOS) {
      const source = readK6Script(scenario.scriptFile);

      expect(source).toContain(`'./common.js'`);
      expect(source).toContain(`'${scenario.name}'`);
      expect(source).toContain('export const options');
      expect(source).not.toContain('node:');
      expect(source).not.toContain('from "node');
    }
  });

  it('모든 scenario가 threshold failure를 k6 pass/fail 기준으로 둔다', () => {
    for (const scenario of K6_HTTP_SCENARIOS) {
      const source = readK6Script(scenario.scriptFile);

      for (const thresholdKey of scenario.thresholdKeys) {
        expect(source).toContain(thresholdKey);
      }

      expect(source).toMatch(/p\(95\)</u);
      expect(source).toMatch(/checks\{scenario:/u);
    }
  });

  it('duplicated k6 guard가 production override token과 target safety rule을 유지한다', () => {
    const source = readK6Script('common.js');

    expect(source).toContain(STRESS_PRODUCTION_OVERRIDE_VALUE);
    expect(source).toContain('STRESS_TARGET_URL is required before HTTP stress runs.');
    expect(source).toContain('STRESS_ALLOWED_HOSTS');
    expect(source).toContain('STRESS_ALLOW_PRODUCTION');
    expect(source).toContain('isPrivateIpv4');
    expect(source).toContain('host.docker.internal');
  });

  it('authenticated roommate-search stress path follows the current strict query contract', () => {
    const source = readK6Script('common.js');

    expect(source).toContain(
      '/api/roommate-search?scope=SAME_BUILDING_ONLY&limit=20&sort=MATCH_SCORE',
    );
    expect(source).not.toContain('pageSize=');
    expect(source).not.toContain('/api/roommate-search?campus=');
  });

  it('write-heavy path는 token artifact와 명시 opt-in 없이는 실행하지 않는다', () => {
    const source = readK6Script('common.js');

    expect(source).toContain('STRESS_ACTOR_TOKENS_PATH');
    expect(source).toContain('STRESS_ENABLE_WRITE_MIX');
    expect(source).toContain('write-mix-disabled');
    expect(source).toContain('write-mix-not-seeded');
    expect(source).toContain('bookmark-create');
    expect(source).toContain('match-request-create');
  });

  it('auth password capacity는 실제 credential endpoint와 single-use artifact를 사용한다', () => {
    const source = readK6Script('auth-password-burst.k6.js');

    expect(source).toContain("'/auth/login'");
    expect(source).toContain("'/auth/signup'");
    expect(source).toContain("'/auth/reset-password'");
    expect(source).toContain("'/auth/change-password'");
    expect(source).toContain('STRESS_AUTH_CAPACITY_ARTIFACT_PATH');
    expect(source).toContain('singleUseOrdinal');
    expect(source).toContain('STRESS_AUTH_CAPACITY_SMOKE_MIX');
    expect(source).toContain("'p(99)'");
    expect(source).toContain("profile === 'h9'");
    expect(source).toContain("profile === 'h9' && iteration % 2 === 0");
    expect(source).toContain("profile === 'h9' ? [200, 429] : [200]");
    expect(source).toContain('roommateReadTraffic');
    expect(source).toContain('/api/roommate-search?scope=SAME_BUILDING_ONLY');
    expect(source).not.toMatch(/console\.(?:log|error)/u);
  });

  it('H5는 spike 종료 60초 뒤의 회복 latency를 별도 threshold로 판정한다', () => {
    const source = readK6Script('auth-password-burst.k6.js');

    expect(source).toContain("return 'recovered'");
    expect(source).toContain('http_req_duration{phase:recovered}');
    expect(source).toContain('http_req_failed{phase:recovered}');
    expect(source).toContain('checks{phase:recovered}');
  });

  it('H9는 동일 actor/IP 제한·계정 잠금과 분산 실패를 별도 rate로 판정한다', () => {
    const source = readK6Script('auth-password-burst.k6.js');

    expect(source).toContain("new Rate('auth_throttle_outcome')");
    expect(source).toContain("new Rate('auth_account_lock_outcome')");
    expect(source).toContain('auth_throttle_outcome{scope:same_actor_ip}');
    expect(source).toContain('auth_throttle_outcome{scope:distributed}');
    expect(source).toContain('auth_account_lock_outcome{scope:same_actor_ip}');
    expect(source).toContain('auth_account_lock_outcome{scope:distributed}');
    expect(source).toContain("return iteration % 2 === 0 ? 'same_actor_ip' : 'distributed'");
    expect(source).toContain('1 + (Math.floor(iteration / 2) % (entries.length - 1))');
  });

  it('auth recovery stress는 abuse와 campus NAT 정상 흐름을 분리한다', () => {
    const source = readK6Script('auth-recovery-abuse.k6.js');

    expect(source).toContain("'same-subject'");
    expect(source).toContain("'campus-nat'");
    expect(source).toContain("'distributed-subject'");
    expect(source).toContain('campus NAT traffic is not throttled at the release rate');
    expect(source).toContain("scope !== 'campus-nat' || result.status !== 429");
    expect(source).toContain('{ scenario, endpoint, scope }');
  });

  it('k6 scripts와 runner는 secret을 console 출력하지 않는다', () => {
    const sources = [
      'common.js',
      ...K6_HTTP_SCENARIOS.map((scenario) => scenario.scriptFile),
      'run-k6-scenario.mjs',
    ].map(readK6Script);

    for (const source of sources) {
      expect(source).not.toMatch(
        /console\.log\([^)]*(token|password|cookie|Authorization|email)/iu,
      );
      expect(source).not.toMatch(
        /console\.error\([^)]*(token|password|cookie|Authorization|email)/iu,
      );
    }
  });
});
