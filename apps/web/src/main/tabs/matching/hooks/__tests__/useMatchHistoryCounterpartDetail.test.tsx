import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createPublicProfileTombstone } from '@/test/home-profile-detail-fixtures';
import { useMatchHistoryCounterpartDetail } from '../useMatchHistoryCounterpartDetail';

describe('useMatchHistoryCounterpartDetail', () => {
  it('entry id를 owner client에 전달하고 close 시 진행 중 요청을 abort한다', async () => {
    const signals: AbortSignal[] = [];
    const client = {
      getHistoryCounterpartProfile: vi.fn((_entryId: string, signal?: AbortSignal) => {
        if (signal) signals.push(signal);
        return new Promise<ReturnType<typeof createPublicProfileTombstone>>(() => undefined);
      }),
    };
    const { result } = renderHook(() => useMatchHistoryCounterpartDetail({ client }));

    act(() =>
      result.current.open({
        entryId: 'entry 1/2',
        nickname: '감자친구',
        seasonName: '2026년 1학기',
      }),
    );
    await waitFor(() =>
      expect(client.getHistoryCounterpartProfile).toHaveBeenCalledWith(
        'entry 1/2',
        expect.any(AbortSignal),
      ),
    );
    act(() => result.current.close());

    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.status).toBe('closed');
  });

  it('retry는 같은 entry context를 유지한다', async () => {
    const client = {
      getHistoryCounterpartProfile: vi
        .fn()
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce(createPublicProfileTombstone()),
    };
    const { result } = renderHook(() => useMatchHistoryCounterpartDetail({ client }));

    act(() =>
      result.current.open({
        entryId: 'history-1',
        nickname: '감자친구',
        seasonName: '2026년 1학기',
      }),
    );
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(client.getHistoryCounterpartProfile.mock.calls.map(([entryId]) => entryId)).toEqual([
      'history-1',
      'history-1',
    ]);
  });
});
