import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBffRequest as createRequest,
  firstFetchInit,
  firstFetchInput,
  stubJsonFetch,
} from '../../../test/bff-route';
import { POST as requestUnmatch } from '../matches/active/[id]/unmatch-request/route';
import { POST as cancelUnmatchRequest } from '../matches/active/[id]/unmatch-request/cancel/route';

const AUTH_TOKEN = `v1.session-matches.${'a'.repeat(43)}`;

describe('matches BFF forwarding routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('active match unmatch request/cancel route는 protected forwarding으로 path segment를 encode한다', async () => {
    const requestFetchMock = stubJsonFetch({ activeMatch: { id: 'active 1/2' } });
    const requestInput = createRequest('/api/matches/active/active%201%2F2/unmatch-request', {
      method: 'POST',
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await requestUnmatch(requestInput, { params: { id: 'active 1/2' } });

    expect(firstFetchInput(requestFetchMock)).toBe(
      'http://localhost:4000/api/matches/active/active%201%2F2/unmatch-request',
    );
    expect(firstFetchInit(requestFetchMock)).toEqual(
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
    expect(firstFetchInit(requestFetchMock)).not.toHaveProperty('body');

    vi.unstubAllGlobals();
    const cancelFetchMock = stubJsonFetch({ activeMatch: { id: 'active 1/2' } });
    const cancelInput = createRequest('/api/matches/active/active%201%2F2/unmatch-request/cancel', {
      method: 'POST',
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    await cancelUnmatchRequest(cancelInput, { params: { id: 'active 1/2' } });

    expect(firstFetchInput(cancelFetchMock)).toBe(
      'http://localhost:4000/api/matches/active/active%201%2F2/unmatch-request/cancel',
    );
    expect(firstFetchInit(cancelFetchMock)).toEqual(
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
    expect(firstFetchInit(cancelFetchMock)).not.toHaveProperty('body');
  });
});
