import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../generated/prisma/client.js';
import { BookmarkPresenter } from '../presenters/bookmark.presenter.js';
import { CreateBookmarkCommand } from './create-bookmark.command.js';

const now = new Date('2026-06-08T00:00:00.000Z');
const authUser = { id: 'viewer-user', campus: 'CHUNCHEON', gender: 'M' } as never;

function bookmark(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bookmark-1',
    viewerUserId: 'viewer-user',
    seasonId: 'season-1',
    targetUserId: 'target-user',
    targetParticipantId: 'target-participant',
    bookmarkedAt: now,
    deletedAt: null,
    expiredAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as never;
}

function makeUniqueError() {
  return new Prisma.PrismaClientKnownRequestError('active bookmark unique violation', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['viewerUserId', 'seasonId', 'targetParticipantId'] },
  });
}

describe('CreateBookmarkCommand', () => {
  const tx = {};
  const prisma = {
    getDatabaseNow: vi.fn(),
    runSerializableTransaction: vi.fn(),
  };
  const repository = {
    findActiveByParticipant: vi.fn(),
    findRestorableByParticipant: vi.fn(),
    restore: vi.fn(),
    create: vi.fn(),
  };
  const targetPolicyEvaluator = {
    resolveCreateTarget: vi.fn(),
  };

  function command() {
    return new CreateBookmarkCommand(
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
    targetPolicyEvaluator.resolveCreateTarget.mockResolvedValue({
      viewerContext: { currentSeasonId: 'season-1' },
      targetUserId: 'target-user',
      targetParticipantId: 'target-participant',
      policy: { actions: { canBookmark: true } },
    });
    repository.findActiveByParticipant.mockResolvedValue(null);
    repository.findRestorableByParticipant.mockResolvedValue(null);
    repository.create.mockResolvedValue(bookmark());
  });

  it('transaction 내부 target stale recheck 후 active bookmark를 생성한다', async () => {
    await expect(
      command().execute({ authUser, targetUserId: 'target-user' }),
    ).resolves.toMatchObject({
      created: true,
      bookmark: {
        id: 'bookmark-1',
        targetUserId: 'target-user',
        targetParticipantId: 'target-participant',
      },
    });

    expect(targetPolicyEvaluator.resolveCreateTarget).toHaveBeenCalledWith({
      authUser,
      targetUserId: 'target-user',
      now,
      client: tx,
    });
    expect(repository.create).toHaveBeenCalledWith({
      client: tx,
      viewerUserId: 'viewer-user',
      seasonId: 'season-1',
      targetUserId: 'target-user',
      targetParticipantId: 'target-participant',
      now,
    });
  });

  it('deleted row restore는 새 active row 생성 없이 idempotent create success로 반환한다', async () => {
    repository.findRestorableByParticipant.mockResolvedValue(bookmark({ deletedAt: now }));
    repository.restore.mockResolvedValue(bookmark({ id: 'bookmark-restored' }));

    await expect(
      command().execute({ authUser, targetUserId: 'target-user' }),
    ).resolves.toMatchObject({
      created: true,
      bookmark: { id: 'bookmark-restored' },
    });

    expect(repository.restore).toHaveBeenCalledWith({
      client: tx,
      bookmarkId: 'bookmark-1',
      now,
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('concurrent create unique race는 active row 재조회 후 created=false로 수렴한다', async () => {
    prisma.runSerializableTransaction.mockRejectedValueOnce(makeUniqueError());
    repository.findActiveByParticipant.mockResolvedValueOnce(bookmark({ id: 'bookmark-existing' }));

    await expect(
      command().execute({ authUser, targetUserId: 'target-user' }),
    ).resolves.toMatchObject({
      created: false,
      bookmark: { id: 'bookmark-existing' },
    });

    expect(targetPolicyEvaluator.resolveCreateTarget).toHaveBeenLastCalledWith({
      authUser,
      targetUserId: 'target-user',
      now,
    });
    expect(repository.findActiveByParticipant).toHaveBeenLastCalledWith({
      viewerUserId: 'viewer-user',
      seasonId: 'season-1',
      targetParticipantId: 'target-participant',
    });
  });
});
