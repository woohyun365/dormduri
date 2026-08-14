import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createPublicProfileFull } from '@/test/home-profile-detail-fixtures';
import { createRoommateApiError } from '../../api/roommateApiErrors';
import {
  useRoommateProfileDetail,
  type RoommateProfileDetailClientPort,
  type RoommateProfileDetailTarget,
} from '../useRoommateProfileDetail';
import type { PublicProfile } from '@repo/shared/profile/contract';

function createTarget(overrides: Partial<RoommateProfileDetailTarget> = {}) {
  return {
    targetUserId: 'target-1',
    nickname: '테스트 룸메이트',
    detailEntryToken: 'entry-token-1',
    ...overrides,
  };
}

describe('useRoommateProfileDetail', () => {
  it('open target with token은 loading 후 success profile을 반환한다', async () => {
    const client: RoommateProfileDetailClientPort = {
      getRoommateProfileDetail: vi.fn(async () => createPublicProfileFull({ id: 'target-1' })),
    };
    const { result } = renderHook(() => useRoommateProfileDetail({ client }));

    act(() => result.current.open(createTarget()));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(client.getRoommateProfileDetail).toHaveBeenCalledWith(
      { targetUserId: 'target-1', detailEntryToken: 'entry-token-1' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.profile?.detailState).toBe('FULL');
  });

  it('close는 진행 중 요청을 abort하고 target/token을 clear한다', async () => {
    let capturedSignal: AbortSignal | undefined;
    const client: RoommateProfileDetailClientPort = {
      getRoommateProfileDetail: vi.fn((_query, options) => {
        capturedSignal = options?.signal;
        return new Promise<PublicProfile>(() => undefined);
      }),
    };
    const { result } = renderHook(() => useRoommateProfileDetail({ client }));

    act(() => result.current.open(createTarget()));
    await waitFor(() => expect(capturedSignal).toBeDefined());
    act(() => result.current.close());

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.status).toBe('closed');
    expect(result.current.target).toBeNull();
  });

  it('unmount는 진행 중 detail request를 abort한다', async () => {
    let capturedSignal: AbortSignal | undefined;
    const client: RoommateProfileDetailClientPort = {
      getRoommateProfileDetail: vi.fn((_query, options) => {
        capturedSignal = options?.signal;
        return new Promise<PublicProfile>(() => undefined);
      }),
    };
    const { result, unmount } = renderHook(() => useRoommateProfileDetail({ client }));

    act(() => result.current.open(createTarget()));
    await waitFor(() => expect(capturedSignal).toBeDefined());
    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it('이전 target의 늦은 응답은 최신 target을 덮어쓰지 못한다', async () => {
    let resolveFirst: ((profile: PublicProfile) => void) | undefined;
    let resolveSecond: ((profile: PublicProfile) => void) | undefined;
    const client: RoommateProfileDetailClientPort = {
      getRoommateProfileDetail: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<PublicProfile>((resolve) => {
              resolveFirst = resolve;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise<PublicProfile>((resolve) => {
              resolveSecond = resolve;
            }),
        ),
    };
    const { result } = renderHook(() => useRoommateProfileDetail({ client }));

    act(() => result.current.open(createTarget({ targetUserId: 'target-old', nickname: '이전' })));
    act(() =>
      result.current.open(
        createTarget({
          targetUserId: 'target-new',
          nickname: '최신',
          detailEntryToken: 'entry-token-2',
        }),
      ),
    );
    act(() => resolveFirst?.(createPublicProfileFull({ id: 'target-old', nickname: '이전' })));
    act(() => resolveSecond?.(createPublicProfileFull({ id: 'target-new', nickname: '최신' })));

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current.target?.targetUserId).toBe('target-new');
    expect(result.current.profile).toMatchObject({ id: 'target-new', nickname: '최신' });
  });

  it('detailEntryToken이 없으면 fetch하지 않고 fail-closed error가 된다', async () => {
    const client: RoommateProfileDetailClientPort = {
      getRoommateProfileDetail: vi.fn(async () => createPublicProfileFull()),
    };
    const { result } = renderHook(() => useRoommateProfileDetail({ client }));

    act(() => result.current.open(createTarget({ detailEntryToken: null })));

    expect(result.current.status).toBe('error');
    expect(result.current.error?.code).toBe('ROOMMATE_PROFILE_DETAIL_ENTRY_REQUIRED');
    expect(client.getRoommateProfileDetail).not.toHaveBeenCalled();
  });

  it('retry는 storage 없이 현재 memory target으로만 재시도한다', async () => {
    const client: RoommateProfileDetailClientPort = {
      getRoommateProfileDetail: vi
        .fn()
        .mockRejectedValueOnce(
          createRoommateApiError({ code: 'ROOMMATE_PROFILE_DETAIL_NETWORK_ERROR' }),
        )
        .mockResolvedValueOnce(createPublicProfileFull({ id: 'target-1' })),
    };
    const { result } = renderHook(() => useRoommateProfileDetail({ client }));

    act(() => result.current.open(createTarget()));
    await waitFor(() => expect(result.current.status).toBe('error'));
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(client.getRoommateProfileDetail).toHaveBeenCalledTimes(2);
    expect(client.getRoommateProfileDetail).toHaveBeenLastCalledWith(
      { targetUserId: 'target-1', detailEntryToken: 'entry-token-1' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
