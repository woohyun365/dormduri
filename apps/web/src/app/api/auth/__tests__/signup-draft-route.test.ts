import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as postSignupDraft } from '../validate-signup-draft/route';
import { POST as postSignupProfileCompatibility } from '../validate-signup-profile/route';

const DRAFT_BODY = {
  email: 'student@kangwon.ac.kr',
  password: 'pass1234',
  nickname: '테스터',
};

function request(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify(DRAFT_BODY),
  });
}

describe('auth signup draft BFF routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('canonical validate-signup-draft route forwards to backend draft endpoint', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postSignupDraft(request('/api/auth/validate-signup-draft'));

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/validate-signup-draft',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(DRAFT_BODY),
      }),
    );
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('deprecated validate-signup-profile route is a compatibility alias for backend draft endpoint', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await postSignupProfileCompatibility(
      request('/api/auth/validate-signup-profile'),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4000/auth/validate-signup-draft',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(DRAFT_BODY),
      }),
    );
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
