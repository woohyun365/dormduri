import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchOverviewResponse } from '@repo/shared/match/contract';
import { useMatchingOverview } from '../useMatchingOverview';

function overview(id: string): MatchOverviewResponse {
  return {
    serverNow: '2026-08-01T00:00:00.000Z',
    season: {
      id,
      state: 'SEASON_MATCHING',
      roomSelectionDate: '2026-08-10',
      seasonEndDate: '2026-08-31',
    },
    capability: { canViewMatching: true, reason: null },
    sentRequests: [],
    receivedRequests: [],
    activeMatch: null,
    activity: [],
  };
}

describe('useMatchingOverview identity boundary', () => {
  it('viewer/season identity가 바뀌면 이전 fetch와 snapshot을 폐기한다', async () => {
    const resolvers: Array<(value: MatchOverviewResponse) => void> = [];
    const signals: AbortSignal[] = [];
    const client = {
      getOverview: vi.fn((signal?: AbortSignal) => {
        if (signal) signals.push(signal);
        return new Promise<MatchOverviewResponse>((resolve) => resolvers.push(resolve));
      }),
    };

    const { result, rerender } = renderHook(
      ({ identityKey }) => useMatchingOverview({ client, identityKey }),
      { initialProps: { identityKey: 'viewer-1:season-1' } },
    );

    await waitFor(() => expect(client.getOverview).toHaveBeenCalledTimes(1));
    rerender({ identityKey: 'viewer-2:season-2' });
    await waitFor(() => expect(client.getOverview).toHaveBeenCalledTimes(2));

    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolvers[1]?.(overview('season-2'));
    });
    await waitFor(() => expect(result.current.data?.season.id).toBe('season-2'));
  });
});
