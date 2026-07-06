import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createRoommateApiError } from '../../api/roommateApiErrors';
import {
  useRoommateActions,
  type RoommateActionTargetSnapshot,
  type RoommateActionsClientPort,
} from '../useRoommateActions';

const serverTime = '2026-06-08T00:00:00.000Z';

function createTarget(
  overrides: Partial<RoommateActionTargetSnapshot> = {},
): RoommateActionTargetSnapshot {
  return {
    targetUserId: 'target-1',
    nickname: '테스트 룸메이트',
    actions: {
      canBookmark: true,
      canRequestMatch: true,
      canStartChat: false,
      unavailableReasons: [],
    },
    ...overrides,
  };
}

function createMatchRequestActionResponse() {
  return {
    request: {
      id: 'request-1',
      seasonId: 'season-1',
      direction: 'SENT' as const,
      counterpartUserId: 'target-1',
      counterpartParticipantId: 'participant-target-1',
      counterpartSummary: {
        id: 'target-1',
        sourceProfile: 'SEASON_PARTICIPANT_PROFILE' as const,
        relation: { type: 'GENERAL' as const },
        exposure: {
          listSummaryVisible: true,
          detailViewable: true,
          canViewFull: true,
          scoreVisible: true,
        },
        actions: {
          canBookmark: true,
          canRequestMatch: true,
          canStartChat: false,
          unavailableReasons: [],
        },
        resultRead: { resultReadable: false, context: 'NONE' as const },
        profileSummary: {
          nickname: '테스트 룸메이트',
          intro: '조용한 생활을 선호해요.',
          smokingBehavior: 'NO' as const,
          sleepHabit: 'NONE' as const,
          relationshipStyle: 'CASUAL' as const,
        },
        bookmark: { bookmarked: false },
        detailEntryToken: 'detail-token-1',
        matchScore: 88,
      },
      status: 'PENDING' as const,
      note: '잘 부탁해요.',
      createdAt: serverTime,
      expiresAt: '2026-06-13T00:00:00.000Z',
      terminalAt: null,
      acceptedAt: null,
      terminalReason: null,
    },
    activeMatch: null,
  };
}

function createClient(
  overrides: Partial<RoommateActionsClientPort> = {},
): RoommateActionsClientPort {
  return {
    createRoommateBlock: vi.fn(async (targetUserId: string, body) => ({
      block: {
        id: 'block-1',
        blockedUserId: targetUserId,
        blockedAt: serverTime,
        note: body.note ?? null,
      },
      created: true,
      listMetadata: { serverTime },
    })),
    createRoommateReport: vi.fn(async (body) => ({
      report: {
        id: 'report-1',
        targetType: body.targetType,
        reason: body.reason,
        receivedAt: serverTime,
        status: 'RECEIVED' as const,
      },
      received: true,
      optionalActionResult:
        body.optionalAction === 'BLOCK_TARGET'
          ? { action: 'BLOCK_TARGET' as const, status: 'SUCCEEDED' as const }
          : null,
    })),
    createRoommateMatchRequest: vi.fn(async () => createMatchRequestActionResponse()),
    ...overrides,
  };
}

function createOptions(client: RoommateActionsClientPort) {
  return {
    client,
    onRefreshSearch: vi.fn(async () => {}),
    onRefreshBookmarks: vi.fn(async () => {}),
    onRefreshDetail: vi.fn(async () => {}),
    onCloseDetail: vi.fn(),
  };
}

describe('useRoommateActions', () => {
  it('duplicate pending target은 두 번째 제출을 실행하지 않는다', async () => {
    let resolveBlock!: () => void;
    const blockPromise = new Promise<
      Awaited<ReturnType<RoommateActionsClientPort['createRoommateBlock']>>
    >((resolve) => {
      resolveBlock = () =>
        resolve({
          block: { id: 'block-1', blockedUserId: 'target-1', blockedAt: serverTime, note: null },
          created: true,
          listMetadata: { serverTime },
        });
    });
    const client = createClient({ createRoommateBlock: vi.fn(() => blockPromise) });
    const options = createOptions(client);
    const { result } = renderHook(() => useRoommateActions(options));

    act(() => result.current.openBlockDialog(createTarget()));
    await act(async () => {
      void result.current.submitBlock({ note: null });
      void result.current.submitBlock({ note: null });
    });

    expect(client.createRoommateBlock).toHaveBeenCalledTimes(1);
    expect(result.current.pendingTargetUserIds).toEqual(['target-1']);

    await act(async () => {
      resolveBlock();
      await blockPromise;
    });
    await waitFor(() => expect(result.current.pendingTargetUserIds).toEqual([]));
  });

  it('block 성공은 detail을 닫고 search/bookmark owner list를 재조회한다', async () => {
    const client = createClient();
    const options = createOptions(client);
    const { result } = renderHook(() => useRoommateActions(options));

    act(() => result.current.openBlockDialog(createTarget()));
    await act(async () => {
      await result.current.submitBlock({ note: '다시 매칭하고 싶지 않음' });
    });

    expect(client.createRoommateBlock).toHaveBeenCalledWith(
      'target-1',
      { note: '다시 매칭하고 싶지 않음' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(options.onCloseDetail).toHaveBeenCalledTimes(1);
    expect(options.onRefreshSearch).toHaveBeenCalledTimes(1);
    expect(options.onRefreshBookmarks).toHaveBeenCalledTimes(1);
    expect(result.current.lastReceipt?.title).toBe('차단을 반영했어요.');
  });

  it('report 성공은 receipt를 저장하고 optional block 성공 시 list를 재조회한다', async () => {
    const client = createClient();
    const options = createOptions(client);
    const { result } = renderHook(() => useRoommateActions(options));

    act(() => result.current.openReportDialog(createTarget()));
    await act(async () => {
      await result.current.submitReport({
        reason: 'FALSE_PROFILE',
        detail: '프로필이 맞지 않아요.',
        optionalBlock: true,
      });
    });

    expect(client.createRoommateReport).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'PROFILE',
        targetId: 'target-1',
        reason: 'FALSE_PROFILE',
        optionalAction: 'BLOCK_TARGET',
        falseReportDisclaimerAccepted: true,
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.lastReceipt?.title).toBe('신고를 접수했어요.');
    expect(result.current.lastReceipt?.message).toContain('차단도 반영');
    expect(options.onRefreshSearch).toHaveBeenCalledTimes(1);
    expect(options.onRefreshBookmarks).toHaveBeenCalledTimes(1);
  });

  it('match request stale failure는 safe error를 저장하고 list/detail을 최신화한다', async () => {
    const client = createClient({
      createRoommateMatchRequest: vi.fn(async () => {
        throw createRoommateApiError({ code: 'MATCH_REQUEST_NOT_ALLOWED', status: 409 });
      }),
    });
    const options = createOptions(client);
    const { result } = renderHook(() => useRoommateActions(options));

    act(() => result.current.openMatchRequestDialog(createTarget()));
    await act(async () => {
      await result.current.submitMatchRequest({ note: '잘 부탁해요.' });
    });

    expect(result.current.lastError?.title).toBe('매칭 요청을 보낼 수 없어요.');
    expect(result.current.lastError?.message).toContain('목록을 새로고침');
    expect(options.onCloseDetail).toHaveBeenCalledTimes(1);
    expect(options.onRefreshSearch).toHaveBeenCalledTimes(1);
    expect(options.onRefreshBookmarks).toHaveBeenCalledTimes(1);
  });

  it('pending action 중 dialog를 닫으면 요청을 abort하고 사용자 오류를 표시하지 않는다', async () => {
    let capturedSignal: AbortSignal | undefined;
    const client = createClient({
      createRoommateBlock: vi.fn(
        (_targetUserId, _body, options) =>
          new Promise<Awaited<ReturnType<RoommateActionsClientPort['createRoommateBlock']>>>(
            (_, reject) => {
              capturedSignal = options?.signal;
              capturedSignal?.addEventListener('abort', () => {
                reject(new DOMException('aborted', 'AbortError'));
              });
            },
          ),
      ),
    });
    const options = createOptions(client);
    const { result } = renderHook(() => useRoommateActions(options));

    act(() => result.current.openBlockDialog(createTarget()));
    let submitPromise!: Promise<void>;
    await act(async () => {
      submitPromise = result.current.submitBlock({ note: null });
    });

    expect(result.current.pendingTargetUserIds).toEqual(['target-1']);
    expect(capturedSignal?.aborted).toBe(false);

    await act(async () => {
      result.current.closeDialog();
      await submitPromise;
    });

    expect(capturedSignal?.aborted).toBe(true);
    expect(result.current.pendingTargetUserIds).toEqual([]);
    expect(result.current.lastError).toBeNull();
    expect(result.current.lastReceipt).toBeNull();
    expect(options.onRefreshSearch).not.toHaveBeenCalled();
    expect(options.onRefreshBookmarks).not.toHaveBeenCalled();
    expect(options.onCloseDetail).not.toHaveBeenCalled();
  });
});
