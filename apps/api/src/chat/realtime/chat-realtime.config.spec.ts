import { describe, expect, it } from 'vitest';
import {
  createChatRealtimeSettings,
  readChatRealtimeProxyProfile,
} from './chat-realtime.config.js';
import { API_ENV_VALIDATION_SCHEMA } from '../../config/composition/api-config.registry.js';

describe('chat forwarding activation', () => {
  it.each([
    '',
    'loopback',
    '10.0.0.1/',
    '10.0.0.1/0x10',
    '10.0.0.1/1e1',
    '0.0.0.0/0',
    '::/0',
    '10.0.0.1,,10.0.0.2',
  ])('rejects unsupported peers %s in factory and composition', (cidrs) => {
    const env = {
      NODE_ENV: 'test',
      CHAT_REALTIME_TRUST_PROXY: 'true',
      HTTP_TRUST_PROXY_CIDRS: cidrs,
    };
    expect(() => readChatRealtimeProxyProfile(env)).toThrow();
    expect(API_ENV_VALIDATION_SCHEMA.validate(env).error).toBeDefined();
  });
  it.each(['1', '2'])('rejects hops-only and mixed forwarding (%s)', (hops) => {
    for (const cidrs of ['', '10.0.0.2']) {
      const env = {
        NODE_ENV: 'test',
        CHAT_REALTIME_TRUST_PROXY: 'true',
        HTTP_TRUST_PROXY_HOPS: hops,
        HTTP_TRUST_PROXY_CIDRS: cidrs,
      };
      expect(() => createChatRealtimeSettings(env)).toThrow();
      expect(API_ENV_VALIDATION_SCHEMA.validate(env).error).toBeDefined();
    }
  });
  it('preserves HTTP-only legacy modes without implicitly enabling chat', () => {
    for (const http of [{ HTTP_TRUST_PROXY_HOPS: '1' }, { HTTP_TRUST_PROXY_CIDRS: 'loopback' }]) {
      const env = { ...http, NODE_ENV: 'test', CHAT_REALTIME_TRUST_PROXY: 'false' };
      expect(API_ENV_VALIDATION_SCHEMA.validate(env).error).toBeUndefined();
      expect(createChatRealtimeSettings(env).proxyProfile.enabled).toBe(false);
    }
  });
  it('does not expose mutable origin configuration to DI consumers', () => {
    const settings = createChatRealtimeSettings({
      CHAT_REALTIME_ALLOWED_ORIGINS: 'https://api.example',
    });
    expect(settings.allowedOrigins).not.toBe(false);
    if (settings.allowedOrigins === false) throw new Error('Missing fixture origins');
    expect(Reflect.set(settings.allowedOrigins, '0', 'https://evil.example')).toBe(false);
    expect(settings.allowedOrigins).toEqual(['https://api.example']);
  });

  it('freezes explicit effective peers independent of later env changes', () => {
    const env = {
      CHAT_REALTIME_TRUST_PROXY: 'true',
      HTTP_TRUST_PROXY_HOPS: '0',
      HTTP_TRUST_PROXY_CIDRS: '10.0.0.2',
    };
    const settings = createChatRealtimeSettings(env);
    env.HTTP_TRUST_PROXY_CIDRS = '10.0.0.3';
    expect(settings.proxyProfile.isTrustedPeer('10.0.0.2')).toBe(true);
    expect(settings.proxyProfile.isTrustedPeer('10.0.0.3')).toBe(false);
    expect(Object.isFrozen(settings)).toBe(true);
    expect(Object.isFrozen(settings.proxyProfile)).toBe(true);
  });
});
