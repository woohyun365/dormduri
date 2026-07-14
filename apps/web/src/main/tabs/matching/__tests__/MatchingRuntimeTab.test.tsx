import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MatchingRuntimeTab } from '../MatchingRuntimeTab';

describe('MatchingRuntimeTab', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('legacy props 없이 real BFF overview를 읽고 badge selector를 알린다', async () => {
    const onBadgeCountChange = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            serverNow: '2026-08-01T00:00:00.000Z',
            season: { id: 'season-1', state: 'SEASON_MATCHING', roomSelectionDate: '2026-08-10' },
            capability: { canViewMatching: true, reason: null },
            sentRequests: [],
            receivedRequests: [],
            activeMatch: null,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    render(<MatchingRuntimeTab viewerId="viewer-1" onBadgeCountChange={onBadgeCountChange} />);

    await expect(screen.findByRole('heading', { name: '매칭 현황' })).resolves.toBeInTheDocument();
    await waitFor(() => expect(onBadgeCountChange).toHaveBeenLastCalledWith(0));
    expect(fetch).toHaveBeenCalledWith(
      '/api/matches/overview',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
