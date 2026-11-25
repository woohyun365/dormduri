import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_ACTIVITY_HEADER } from '@/bff/session-activity';
import { postBff, SESSION_ACTIVITY_EVENT, SESSION_CLOSED_EVENT } from './bff-client';

const fetchMock = vi.fn<typeof fetch>();
const activity = vi.fn();
const closed = vi.fn();

function answer(status: number, body: unknown, reachedApi: boolean) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(reachedApi ? { [SESSION_ACTIVITY_HEADER]: '1' } : {}),
    },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  window.addEventListener(SESSION_ACTIVITY_EVENT, activity);
  window.addEventListener(SESSION_CLOSED_EVENT, closed);
});

afterEach(() => {
  window.removeEventListener(SESSION_ACTIVITY_EVENT, activity);
  window.removeEventListener(SESSION_CLOSED_EVENT, closed);
  fetchMock.mockReset();
  activity.mockReset();
  closed.mockReset();
});

describe('postBff', () => {
  it.each([
    ['a success the API answered', answer(200, { ok: true }, true), 1],
    [
      'a permission refusal the API answered',
      answer(403, { error: { code: 'permission_denied' } }, true),
      1,
    ],
    [
      'a body the BFF refused before the API',
      answer(400, { error: { code: 'invalid_request' } }, false),
      0,
    ],
    [
      'an API the BFF could not reach',
      answer(503, { error: { code: 'upstream_unavailable' } }, false),
      0,
    ],
    ['an ended session', answer(401, { error: { code: 'session_expired' } }, false), 0],
  ])('restarts the idle countdown only for %s', async (_name, response, events) => {
    fetchMock.mockResolvedValueOnce(response);
    await postBff('/api/access/requests');
    expect(activity).toHaveBeenCalledTimes(events);
  });

  it('reads the error code and keeps a generic one for a body it cannot read', async () => {
    fetchMock.mockResolvedValueOnce(answer(403, { error: { code: 'permission_denied' } }, true));
    expect(await postBff('/api/access/requests')).toEqual({
      ok: false,
      status: 403,
      code: 'permission_denied',
    });
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 502 }));
    expect(await postBff('/api/access/requests')).toEqual({
      ok: false,
      status: 502,
      code: 'internal_error',
    });
  });

  it('announces a closed session when the BFF answers 401 session_required', async () => {
    fetchMock.mockResolvedValueOnce(answer(401, { error: { code: 'session_required' } }, false));
    expect(await postBff('/api/auth/passkeys/options')).toEqual({
      ok: false,
      status: 401,
      code: 'session_required',
    });
    expect(closed).toHaveBeenCalledTimes(1);

    fetchMock
      .mockResolvedValueOnce(answer(401, { error: { code: 'session_expired' } }, false))
      .mockResolvedValueOnce(answer(403, { error: { code: 'permission_denied' } }, true))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await postBff('/api/access/requests');
    await postBff('/api/access/requests');
    expect(await postBff('/api/access/requests')).toEqual({
      ok: false,
      status: 0,
      code: 'network_error',
    });
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
