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
  it('Phase 6 matrix의 모든 HTTP scenario script가 존재하고 k6 runtime import만 사용한다', () => {
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

  it('duplicated k6 guard가 Phase 5 production override token과 target safety rule을 유지한다', () => {
    const source = readK6Script('common.js');

    expect(source).toContain(STRESS_PRODUCTION_OVERRIDE_VALUE);
    expect(source).toContain('STRESS_TARGET_URL is required before HTTP stress runs.');
    expect(source).toContain('STRESS_ALLOWED_HOSTS');
    expect(source).toContain('STRESS_ALLOW_PRODUCTION');
    expect(source).toContain('isPrivateIpv4');
    expect(source).toContain('host.docker.internal');
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
