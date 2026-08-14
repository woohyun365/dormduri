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

  it('network error는 row를 authoritative refetch하지 않고 같은 action retry를 허용한다', async () => {
    const acceptRequest = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
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

    await act(async () => {
      expect(await result.current.accept('request-1')).toBe('error');
    });
    expect(result.current.error?.code).toBe('MATCHING_API_NETWORK');
    expect(refetchOverview).not.toHaveBeenCalled();

    await act(async () => {
      expect(await result.current.accept('request-1')).toBe('success');
    });
    expect(acceptRequest).toHaveBeenCalledTimes(2);
    expect(refetchOverview).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
  });

  it('unmount하면 진행 중인 request action AbortSignal을 취소한다', async () => {
    let signal: AbortSignal | undefined;
    const acceptRequest = vi.fn(
      (_id: string, nextSignal?: AbortSignal) =>
        new Promise<void>((_resolve, reject) => {
          signal = nextSignal;
          nextSignal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const { result, unmount } = renderHook(() =>
      useMatchingActions({
        client: {
          acceptRequest,
          rejectRequest: vi.fn(),
          cancelRequest: vi.fn(),
          requestUnmatch: vi.fn(),
          cancelUnmatchRequest: vi.fn(),
        } as never,
        refetchOverview: vi.fn(),
      }),
    );

    act(() => void result.current.accept('request-1'));
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('같은 active relation의 request/cancel을 하나의 conflict key로 잠근다', async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    const requestUnmatch = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const cancelUnmatchRequest = vi.fn();
    const { result } = renderHook(() =>
      useMatchingActions({
        client: {
          acceptRequest: vi.fn(),
          rejectRequest: vi.fn(),
          cancelRequest: vi.fn(),
          requestUnmatch,
          cancelUnmatchRequest,
        } as never,
        refetchOverview: vi.fn().mockResolvedValue(undefined),
      }),
    );

    act(() => {
      void result.current.requestUnmatch('active-1');
      void result.current.cancelUnmatchRequest('active-1');
    });
    expect(requestUnmatch).toHaveBeenCalledTimes(1);
    expect(cancelUnmatchRequest).not.toHaveBeenCalled();
    expect(result.current.isPending('requestUnmatch', 'active-1')).toBe(true);
    expect(result.current.isPending('cancelUnmatchRequest', 'active-1')).toBe(true);

    await act(async () => {
      resolveRequest({ activeMatch: { status: 'ACTIVE' } });
    });
  });

  it('mutual unmatch 완료 response를 refetch 뒤 1회성 feedback으로 보존한다', async () => {
    const requestUnmatch = vi.fn().mockResolvedValue({
      activeMatch: {
        id: 'active-1',
        status: 'UNMATCHED',
        endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
      },
    });
    const refetchOverview = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useMatchingActions({
        client: {
          acceptRequest: vi.fn(),
          rejectRequest: vi.fn(),
          cancelRequest: vi.fn(),
          requestUnmatch,
          cancelUnmatchRequest: vi.fn(),
        } as never,
        refetchOverview,
      }),
    );

    await act(async () => {
      expect(await result.current.requestUnmatch('active-1')).toBe('success');
    });
    expect(refetchOverview).toHaveBeenCalledTimes(1);
    expect(result.current.unmatchCompletion).toEqual({
      activeMatchId: 'active-1',
      message: '두 사람 모두 동의해 매칭이 해제되었어요.',
    });

    act(() => result.current.dismissUnmatchCompletion());
    expect(result.current.unmatchCompletion).toBeNull();
  });

  it('request와 active action error를 서로 다른 scope로 유지한다', async () => {
    const { result } = renderHook(() =>
      useMatchingActions({
        client: {
          acceptRequest: vi.fn(),
          rejectRequest: vi.fn(),
          cancelRequest: vi.fn(),
          requestUnmatch: vi.fn().mockRejectedValue(new Error('offline')),
          cancelUnmatchRequest: vi.fn(),
        } as never,
        refetchOverview: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.requestUnmatch('active-1');
    });
    expect(result.current.requestError).toBeNull();
    expect(result.current.activeError?.code).toBe('MATCHING_API_NETWORK');
  });

  it('거절과 취소 성공을 overview refetch 이후 1회성 feedback으로 보존한다', async () => {
    const { result } = renderHook(() =>
      useMatchingActions({
        client: {
          acceptRequest: vi.fn(),
          rejectRequest: vi.fn().mockResolvedValue(undefined),
          cancelRequest: vi.fn().mockResolvedValue(undefined),
          requestUnmatch: vi.fn(),
          cancelUnmatchRequest: vi.fn(),
        } as never,
        refetchOverview: vi.fn().mockResolvedValue(undefined),
      }),
    );

    await act(async () => {
      await result.current.reject('request-received');
    });
    expect(result.current.requestCompletion?.message).toBe('매칭 요청을 거절했어요.');

    await act(async () => {
      await result.current.cancel('request-sent');
    });
    expect(result.current.requestCompletion?.message).toBe('보낸 매칭 요청을 취소했어요.');

    act(() => result.current.dismissRequestCompletion());
    expect(result.current.requestCompletion).toBeNull();
  });
});
