import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ARTILLERY_REALTIME_SCENARIOS } from './realtime-scenarios.js';

const artilleryRoot = join(process.cwd(), 'test/stress/realtime/artillery');

function readScript(fileName: string) {
  return readFileSync(join(artilleryRoot, fileName), 'utf8');
}

describe('Artillery realtime stress scripts static contract', () => {
  it('Phase 7 matrix의 모든 realtime scenario script가 존재한다', () => {
    for (const scenario of ARTILLERY_REALTIME_SCENARIOS) {
      const source = readScript(scenario.scriptFile);

      expect(source).toContain('engine: socketio');
      expect(source).toContain("processor: './processor.cjs'");
      expect(source).toContain("target: '{{ $env.STRESS_TARGET_URL }}'");
    }
  });

  it('Socket.IO /chat namespace와 handshake auth ticket flow만 사용한다', () => {
    for (const scenario of ARTILLERY_REALTIME_SCENARIOS) {
      const source = readScript(scenario.scriptFile);

      expect(source).toContain("namespace: '/chat'");
      expect(source).toContain("ticket: '{{ realtimeTicket }}'");
      expect(source).toContain('captureRealtimeTicketResponse');
      expect(source).toContain("url: '/api/chat/realtime/tickets'");
      expect(source).not.toMatch(/query:\s*.*ticket/iu);
      expect(source).not.toContain('Authorization:');
    }
  });

  it('thread subscribe/unsubscribe ack latency를 고정하고 message write는 realtime script에서 수행하지 않는다', () => {
    for (const scenario of ARTILLERY_REALTIME_SCENARIOS) {
      const source = readScript(scenario.scriptFile);

      expect(source).toContain("channel: 'chat.thread.subscribe'");
      expect(source).toContain('recordRealtimeSubscribeAttempt');
      expect(source).toContain('recordRealtimeSubscribeAck');
      expect(source).toContain("channel: 'chat.thread.unsubscribe'");
      expect(source).toContain('acknowledge:');
      expect(source).not.toContain("channel: 'chat.message.created'");
      expect(source).not.toContain("url: '/api/chat/messages'");
      expect(source).not.toContain("url: '/api/chat/threads/{{ threadId }}/read-marker'");
    }
  });

  it('runner는 외부 Artillery CLI와 token artifact, target guard를 요구한다', () => {
    const source = readScript('run-artillery-scenario.mjs');

    expect(source).toContain("spawnSync('artillery', ['version']");
    expect(source).toContain('STRESS_ACTOR_TOKENS_PATH');
    expect(source).toContain('STRESS_ARTILLERY_ACTOR_CSV_PATH');
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
