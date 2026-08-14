import { NextRequest } from 'next/server';
import { vi } from 'vitest';

export function createBffRequest(
  path: string,
  init: ConstructorParameters<typeof NextRequest>[1] = {},
) {
  return new NextRequest(`http://localhost${path}`, init);
}

export function stubJsonFetch(json: unknown, status = 200) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function firstFetchInput(fetchMock: ReturnType<typeof stubJsonFetch>): string {
  const input = fetchMock.mock.calls[0]?.[0];
  if (!input) throw new Error('fetch was not called');
  return String(input);
}

export function firstFetchInit(fetchMock: ReturnType<typeof stubJsonFetch>): RequestInit {
  const init = fetchMock.mock.calls[0]?.[1];
  if (!init) throw new Error('fetch init was not provided');
  return init;
}
