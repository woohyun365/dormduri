import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ARTILLERY_REALTIME_SCENARIOS } from './realtime-scenarios.js';

const artilleryRoot = join(process.cwd(), 'test/stress/realtime/artillery');

function readScript(fileName: string) {
  return readFileSync(join(artilleryRoot, fileName), 'utf8');
}

describe('Artillery realtime stress scripts static contract', () => {
  it('realtime scenario matrix의 모든 script가 존재한다', () => {
    for (const scenario of ARTILLERY_REALTIME_SCENARIOS) {
      const source = readScript(scenario.scriptFile);

      expect(source).toContain('engine: socketio');
      expect(source).toContain("processor: './processor.cjs'");
      expect(source).toContain("target: '{{ $env.STRESS_REALTIME_SOCKET_URL }}'");
    }
  });

  it('Socket.IO /chat namespace target과 handshake auth ticket flow만 사용한다', () => {
    for (const scenario of ARTILLERY_REALTIME_SCENARIOS) {
      const source = readScript(scenario.scriptFile);

      expect(source).toContain("target: '{{ $env.STRESS_REALTIME_SOCKET_URL }}'");
      expect(source).toMatch(
        /ticket:\s*'\{\{ (?:realtimeTicket|\$env\.STRESS_REALTIME_TICKET) \}\}'/u,
      );
      expect(source).not.toMatch(/query:\s*.*ticket/iu);
      expect(source).not.toContain('Authorization:');
    }
  });

  it('thread subscribe/unsubscribe ack latency를 고정하고 message write는 realtime script에서 수행하지 않는다', () => {
    for (const scenario of ARTILLERY_REALTIME_SCENARIOS) {
      const source = readScript(scenario.scriptFile);

      expect(source).toMatch(/chat\.thread\.subscribe|emitRealtimeSubscribe/u);
      expect(source).not.toContain("channel: 'chat.message.created'");
      expect(source).not.toContain("url: '/api/chat/messages'");
      expect(source).not.toContain("url: '/api/chat/threads/{{ threadId }}/read-marker'");
    }
  });

  it('local smoke는 pre-issued one-time ticket을 env로 넘겨 실제 handshake 전에 사용할 수 있다', () => {
    const source = readScript('smoke.yml');

    expect(source).toContain("ticket: '{{ $env.STRESS_REALTIME_TICKET }}'");
    expect(source).toContain('beforeScenario: validateRealtimeScenario');
    expect(source).toContain('function: emitRealtimeSubscribe');
    expect(source).toContain('function: emitRealtimeUnsubscribe');
    expect(source).not.toContain('payload:');
    expect(source).not.toContain('acknowledge:');
    expect(source).toContain('maxVusers: 1');
  });

  it('runner는 외부 Artillery CLI와 token artifact, target guard를 요구한다', () => {
    const source = readScript('run-artillery-scenario.mjs');

    expect(source).toContain("spawnSync('artillery', ['version']");
    expect(source).toContain('STRESS_ACTOR_TOKENS_PATH');
    expect(source).toContain('STRESS_ARTILLERY_ACTOR_CSV_PATH');
    expect(source).toContain('STRESS_REALTIME_TICKET');
    expect(source).toContain('STRESS_REALTIME_THREAD_ID');
    expect(source).toContain('STRESS_REALTIME_SOCKET_URL');
    expect(source).toContain('/api/chat/realtime/tickets');
    expect(source).toContain('Only the smoke realtime scenario is executable by this runner');
    expect(source).toContain('STRESS_ALLOW_PRODUCTION');
    expect(source).toContain('STRESS_ALLOWED_HOSTS');
    expect(source).toContain('parse-artillery-summary.ts');
  });

  it('script와 runner는 raw secret을 console/log에 직접 출력하지 않는다', () => {
    const processor = readScript('processor.cjs');
    const runner = readScript('run-artillery-scenario.mjs');

    expect(processor).toContain('[REDACTED_STRESS_SECRET]');
    expect(runner).not.toContain('console.log(actor');
    expect(runner).not.toContain('console.error(actor');
    expect(runner).not.toContain('console.log(artifact');
  });
});
