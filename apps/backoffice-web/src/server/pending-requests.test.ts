import { afterEach, describe, expect, it, vi } from 'vitest';
import { activeAuditor, activeOwner } from '@/ui/__stories__/fixtures';

// The home's pending access requests (design guide ④ dashboard) with the page read faked: an approver gets the first
// page's count, and a read the home cannot use leaves its line saying so instead of failing the whole console.
const fakes = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));
vi.mock('./backoffice-read', () => ({ readBackoffice: fakes.read }));

const { readPendingLegalRequests, readPendingRequests } = await import('./pending-requests');
const { BackofficeUnavailableError } = await import('./session');

afterEach(() => {
  fakes.read.mockReset();
});

describe('readPendingRequests', () => {
  it('reads nothing without the approve permission', async () => {
    await expect(readPendingRequests(activeAuditor.session)).resolves.toBeNull();
    expect(fakes.read).not.toHaveBeenCalled();
  });

  it("counts the first page of pending requests and says when there's a next page", async () => {
    fakes.read.mockResolvedValueOnce({
      kind: 'ok',
      data: { requests: [{}, {}], nextPage: null },
    });
    await expect(readPendingRequests(activeOwner.session)).resolves.toEqual({
      count: 2,
      overflow: false,
    });
    const [path, , query] = fakes.read.mock.calls[0]!;
    expect(path).toBe('/access/requests');
    expect((query as URLSearchParams).get('status')).toBe('PENDING');

    fakes.read.mockResolvedValueOnce({
      kind: 'ok',
      data: { requests: [{}], nextPage: { beforeTime: '2026-11-22T04:00:00.000Z' } },
    });
    await expect(readPendingRequests(activeOwner.session)).resolves.toEqual({
      count: 1,
      overflow: true,
    });
  });

  it('says unavailable for a refusal or a read the home cannot use', async () => {
    fakes.read.mockResolvedValueOnce({ kind: 'forbidden' });
    await expect(readPendingRequests(activeOwner.session)).resolves.toBe('unavailable');
    fakes.read.mockRejectedValueOnce(new BackofficeUnavailableError());
    await expect(readPendingRequests(activeOwner.session)).resolves.toBe('unavailable');
  });

  it('lets an ended session go to the login as every page read does', async () => {
    fakes.read.mockRejectedValueOnce(new Error('redirect /login?ended=closed'));
    await expect(readPendingRequests(activeOwner.session)).rejects.toThrow(
      'redirect /login?ended=closed',
    );
  });
});

describe('readPendingLegalRequests', () => {
  it('reads nothing without the legal approve permission', async () => {
    await expect(readPendingLegalRequests(activeAuditor.session)).resolves.toBeNull();
    expect(fakes.read).not.toHaveBeenCalled();
  });

  it('counts the first page of pending legal requests for a legal approver', async () => {
    fakes.read.mockResolvedValueOnce({
      kind: 'ok',
      data: { requests: [{}, {}, {}], nextPage: null },
    });
    await expect(readPendingLegalRequests(activeOwner.session)).resolves.toEqual({
      count: 3,
      overflow: false,
    });
    const [path, , query] = fakes.read.mock.calls[0]!;
    expect(path).toBe('/legal/requests');
    expect((query as URLSearchParams).get('status')).toBe('PENDING');
  });

  it('says unavailable for a refusal or a read the home cannot use', async () => {
    fakes.read.mockResolvedValueOnce({ kind: 'forbidden' });
    await expect(readPendingLegalRequests(activeOwner.session)).resolves.toBe('unavailable');
    fakes.read.mockRejectedValueOnce(new BackofficeUnavailableError());
    await expect(readPendingLegalRequests(activeOwner.session)).resolves.toBe('unavailable');
  });
});
