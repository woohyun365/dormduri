import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useConversationStats } from '../useConversationStats';

describe('useConversationStats', () => {
  it('명시적 load에서만 읽고 identity 변경 시 이전 요청과 data를 폐기한다', async () => {
    const signals: AbortSignal[] = [];
    const client = {
      getConversationStats: vi.fn((signal?: AbortSignal) => {
        if (signal) signals.push(signal);
        return new Promise<never>(() => undefined);
      }),
    };
    const { result, rerender } = renderHook(
      ({ identityKey }) => useConversationStats({ client, identityKey }),
      { initialProps: { identityKey: 'viewer-1:season-1' } },
    );

    expect(client.getConversationStats).not.toHaveBeenCalled();
    act(() => void result.current.load());
    await waitFor(() => expect(client.getConversationStats).toHaveBeenCalledTimes(1));

    rerender({ identityKey: 'viewer-2:season-2' });
    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('chat stats를 읽어 season aggregate로 제공한다', async () => {
    const client = {
      getConversationStats: vi.fn().mockResolvedValue({
        current: null,
        past: [{ seasonId: 'season-1', seasonName: '2026년 1학기', conversationUserCount: 4 }],
      }),
    };
    const { result } = renderHook(() => useConversationStats({ client }));

    await act(async () => result.current.load());

    expect(result.current.data?.past[0]?.conversationUserCount).toBe(4);
  });
});
