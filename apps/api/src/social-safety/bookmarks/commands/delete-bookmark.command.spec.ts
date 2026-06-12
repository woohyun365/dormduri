import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookmarkPresenter } from '../presenters/bookmark.presenter.js';
import { DeleteBookmarkCommand } from './delete-bookmark.command.js';

const now = new Date('2026-06-08T00:00:00.000Z');
const authUser = { id: 'viewer-user', campus: 'CHUNCHEON', gender: 'M' } as never;

describe('DeleteBookmarkCommand', () => {
  const tx = {};
  const prisma = {
    getDatabaseNow: vi.fn(),
    runSerializableTransaction: vi.fn(),
  };
  const repository = {
    softDeleteActiveByTargetUser: vi.fn(),
  };
  const targetPolicyEvaluator = {
    loadViewerContext: vi.fn(),
  };

  function command() {
    return new DeleteBookmarkCommand(
      prisma as never,
      repository as never,
      targetPolicyEvaluator as never,
      new BookmarkPresenter(),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(now);
    prisma.runSerializableTransaction.mockImplementation((callback: (txArg: unknown) => unknown) =>
      callback(tx),
    );
    targetPolicyEvaluator.loadViewerContext.mockResolvedValue({ currentSeasonId: 'season-1' });
    repository.softDeleteActiveByTargetUser.mockResolvedValue(true);
  });

  it('active bookmark만 viewer/current-season/target 기준으로 soft-delete한다', async () => {
    await expect(command().execute({ authUser, targetUserId: 'target-user' })).resolves.toEqual({
      deleted: true,
      listMetadata: { sort: 'RECENT', serverTime: now.toISOString() },
    });

    expect(repository.softDeleteActiveByTargetUser).toHaveBeenCalledWith({
      client: tx,
      viewerUserId: 'viewer-user',
      seasonId: 'season-1',
      targetUserId: 'target-user',
      now,
    });
  });

  it('missing/already-deleted 또는 다른 viewer bookmark는 idempotent deleted=false로 닫힌다', async () => {
    repository.softDeleteActiveByTargetUser.mockResolvedValue(false);

    await expect(command().execute({ authUser, targetUserId: 'target-user' })).resolves.toEqual({
      deleted: false,
      listMetadata: { sort: 'RECENT', serverTime: now.toISOString() },
    });
  });

  it('current season이 없으면 repository write 없이 idempotent success로 반환한다', async () => {
    targetPolicyEvaluator.loadViewerContext.mockResolvedValue({ currentSeasonId: null });

    await expect(command().execute({ authUser, targetUserId: 'target-user' })).resolves.toEqual({
      deleted: false,
      listMetadata: { sort: 'RECENT', serverTime: now.toISOString() },
    });

    expect(prisma.runSerializableTransaction).not.toHaveBeenCalled();
    expect(repository.softDeleteActiveByTargetUser).not.toHaveBeenCalled();
  });
});
