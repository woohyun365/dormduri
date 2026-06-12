import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockSideEffectService } from './block-side-effect.service.js';

const now = new Date('2026-06-01T00:00:00.000Z');

describe('BlockSideEffectService', () => {
  const tx = {};
  const bookmarkRepository = {
    softDeleteActiveBetweenUsers: vi.fn(),
  };
  const matchBlockSideEffectPort = {
    cancelPendingRequestsForBlock: vi.fn(),
  };
  const chatBlockSideEffectPort = {
    closeDirectThreadsForBlock: vi.fn(),
  };

  function service() {
    return new BlockSideEffectService(
      bookmarkRepository as never,
      matchBlockSideEffectPort,
      chatBlockSideEffectPort,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    bookmarkRepository.softDeleteActiveBetweenUsers.mockResolvedValue(1);
    matchBlockSideEffectPort.cancelPendingRequestsForBlock.mockResolvedValue({
      cancelledRequestIds: ['match-request-1'],
    });
    chatBlockSideEffectPort.closeDirectThreadsForBlock.mockResolvedValue({
      closedThreadIds: ['thread-1'],
    });
  });

  it('block 생성 source pointer를 chat side-effect port에 전달한다', async () => {
    await expect(
      service().applyBlockCreated({
        tx: tx as never,
        seasonId: 'season-1',
        blockerUserId: 'user-blocker',
        blockedUserId: 'user-blocked',
        sourceBlockId: 'block-1',
        now,
      }),
    ).resolves.toEqual({
      removedBookmarkCount: 1,
      match: { cancelledRequestIds: ['match-request-1'] },
      chat: { closedThreadIds: ['thread-1'] },
    });

    expect(bookmarkRepository.softDeleteActiveBetweenUsers).toHaveBeenCalledWith({
      client: tx,
      firstUserId: 'user-blocker',
      secondUserId: 'user-blocked',
      now,
    });
    expect(matchBlockSideEffectPort.cancelPendingRequestsForBlock).toHaveBeenCalledWith(tx, {
      seasonId: 'season-1',
      blockerUserId: 'user-blocker',
      blockedUserId: 'user-blocked',
      occurredAt: now,
    });
    expect(chatBlockSideEffectPort.closeDirectThreadsForBlock).toHaveBeenCalledWith(tx, {
      seasonId: 'season-1',
      blockerUserId: 'user-blocker',
      blockedUserId: 'user-blocked',
      sourceBlockId: 'block-1',
      occurredAt: now,
    });
  });
});
