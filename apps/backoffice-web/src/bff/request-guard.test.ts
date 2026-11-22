import { describe, expect, it } from 'vitest';
import { checkMutationRequest } from './request-guard';

const SAME_ORIGIN = {
  origin: 'http://localhost:4300',
  'sec-fetch-site': 'same-origin',
  host: 'localhost:4300',
};

function headers(values: Record<string, string | undefined>): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) result.set(name, value);
  }
  return result;
}

describe('checkMutationRequest (README §3 Origin·Fetch Metadata·Host)', () => {
  it('accepts a same-origin request to localhost:4300', () => {
    expect(checkMutationRequest(headers(SAME_ORIGIN))).toEqual({ ok: true });
  });

  it.each([
    ['another localhost port', { origin: 'http://localhost:3000' }, 'origin'],
    ['https on the same host', { origin: 'https://localhost:4300' }, 'origin'],
    ['127.0.0.1 instead of localhost', { origin: 'http://127.0.0.1:4300' }, 'origin'],
    ['opaque origin', { origin: 'null' }, 'origin'],
    ['no Origin', { origin: undefined }, 'origin'],
    ['same-site, not same-origin', { 'sec-fetch-site': 'same-site' }, 'fetch-site'],
    ['cross-site', { 'sec-fetch-site': 'cross-site' }, 'fetch-site'],
    ['user typed (none)', { 'sec-fetch-site': 'none' }, 'fetch-site'],
    ['no Sec-Fetch-Site', { 'sec-fetch-site': undefined }, 'fetch-site'],
    ['DNS rebinding host', { host: 'attacker.example:4300' }, 'host'],
    ['another port on the host', { host: 'localhost:3000' }, 'host'],
    ['no Host', { host: undefined }, 'host'],
  ] as const)('rejects %s', (_name, change, reason) => {
    expect(checkMutationRequest(headers({ ...SAME_ORIGIN, ...change }))).toEqual({
      ok: false,
      reason,
    });
  });
});
