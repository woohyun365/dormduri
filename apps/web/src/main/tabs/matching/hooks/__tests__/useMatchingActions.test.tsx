import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MatchingApiError } from '../../api/matching.api';
import { useMatchingActions } from '../useMatchingActions';

describe('useMatchingActions', () => {
  it('같은 action/id의 duplicate submit을 막고 성공 뒤 overview를 refetch한다', async () => {
    let resolveAction: () => void = () => undefined;
    const acceptRequest = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        }),
    );
    const refetchOverview = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useMatchingActions({
        client: {
          acceptRequest,
          rejectRequest: vi.fn(),
          cancelRequest: vi.fn(),
          requestUnmatch: vi.fn(),
          cancelUnmatchRequest: vi.fn(),
        } as never,
        refetchOverview,
      }),
    );

    act(() => {
      void result.current.accept('request-1');
      void result.current.accept('request-1');
    });
    expect(acceptRequest).toHaveBeenCalledTimes(1);
    expect(result.current.isPending('acceptRequest', 'request-1')).toBe(true);
    await act(async () => {
      resolveAction();
    });
    await waitFor(() => expect(refetchOverview).toHaveBeenCalledTimes(1));
  });

  it('stale action은 overview를 다시 읽고 public error를 유지한다', async () => {
    const refetchOverview = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useMatchingActions({
        client: {
          acceptRequest: vi
            .fn()
            .mockRejectedValue(new MatchingApiError('MATCHING_API_STATE_CHANGED')),
          rejectRequest: vi.fn(),
          cancelRequest: vi.fn(),
          requestUnmatch: vi.fn(),
          cancelUnmatchRequest: vi.fn(),
        } as never,
        refetchOverview,
      }),
    );

    await act(async () => {
      await result.current.accept('request-1');
    });
    expect(result.current.error?.code).toBe('MATCHING_API_STATE_CHANGED');
    expect(refetchOverview).toHaveBeenCalledTimes(1);
  });
});
