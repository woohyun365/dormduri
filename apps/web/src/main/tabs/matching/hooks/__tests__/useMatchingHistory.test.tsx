import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createMatchHistoryResponse } from '@/test/home-profile-detail-fixtures';
import { useMatchingHistory } from '../useMatchingHistory';

describe('useMatchingHistory', () => {
  it('명시적으로 load할 때만 history를 읽고 identity 변경 시 이전 요청을 폐기한다', async () => {
    const signals: AbortSignal[] = [];
    const client = {
      getHistory: vi.fn((signal?: AbortSignal) => {
        if (signal) signals.push(signal);
        return new Promise<ReturnType<typeof createMatchHistoryResponse>>(() => undefined);
      }),
    };
    const { result, rerender } = renderHook(
      ({ identityKey }) => useMatchingHistory({ client, identityKey }),
      { initialProps: { identityKey: 'viewer-1:season-1' } },
    );

    expect(client.getHistory).not.toHaveBeenCalled();
    act(() => void result.current.load());
    await waitFor(() => expect(client.getHistory).toHaveBeenCalledTimes(1));

    rerender({ identityKey: 'viewer-2:season-2' });
    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('retry 가능한 오류 뒤 동일 client를 다시 호출한다', async () => {
    const client = {
      getHistory: vi
        .fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce(createMatchHistoryResponse()),
    };
    const { result } = renderHook(() => useMatchingHistory({ client }));

    await act(async () => result.current.load());
    expect(result.current.error?.code).toBe('MATCHING_API_NETWORK');
    await act(async () => result.current.load());
    expect(result.current.data?.items).toHaveLength(1);
  });
});
