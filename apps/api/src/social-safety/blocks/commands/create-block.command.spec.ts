import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../generated/prisma/client.js';
import { BlockPresenter } from '../presenters/block.presenter.js';
import { CreateBlockCommand } from './create-block.command.js';

const now = new Date('2026-06-01T00:00:00.000Z');
const authUser = { id: 'user-blocker', campus: 'CHUNCHEON', gender: 'M' } as never;

interface AppendBlockedEventInput {
  client: unknown;
  block: { id: string };
  now: Date;
}

function block(overrides: Record<string, unknown> = {}) {
  return {
    id: 'block-1',
    blockerUserId: 'user-blocker',
    blockedUserId: 'user-blocked',
    note: '메모',
    blockedAt: now,
    unblockedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as never;
}

function makeUniqueError() {
  return new Prisma.PrismaClientKnownRequestError('active block unique violation', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['blockerUserId', 'blockedUserId'] },
  });
}

describe('CreateBlockCommand', () => {
  const tx = {};
  const prisma = {
    getDatabaseNow: vi.fn(),
    runSerializableTransaction: vi.fn(),
  };
  const repository = {
    findActiveBetween: vi.fn(),
    create: vi.fn(),
    appendBlockedEvent: vi.fn<(arg0: AppendBlockedEventInput) => Promise<void>>(),
  };
  const targetPolicyEvaluator = {
    resolveCreateTarget: vi.fn(),
  };
  const sideEffectService = {
    applyBlockCreated: vi.fn(),
  };

  function command() {
    return new CreateBlockCommand(
      prisma as never,
      repository as never,
      targetPolicyEvaluator as never,
      sideEffectService as never,
      new BlockPresenter(),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.getDatabaseNow.mockResolvedValue(now);
    prisma.runSerializableTransaction.mockImplementation((callback: (txArg: unknown) => unknown) =>
      callback(tx),
    );
    targetPolicyEvaluator.resolveCreateTarget.mockResolvedValue({
      viewerContext: {
        seasonContext: {
          season: { id: 'season-1' },
        },
      },
      targetUserId: 'user-blocked',
    });
    repository.findActiveBetween.mockResolvedValue(null);
    repository.create.mockResolvedValue(block());
    repository.appendBlockedEvent.mockResolvedValue(undefined);
    sideEffectService.applyBlockCreated.mockResolvedValue({
      removedBookmarkCount: 0,
      match: { cancelledRequestIds: [] },
      chat: { closedThreadIds: [] },
    });
  });

  it('새 block 생성 후 같은 transaction에서 block.id를 sourceBlockId로 side-effect에 전달한다', async () => {
    await expect(
      command().execute({
        authUser,
        targetUserId: 'user-blocked',
        note: '메모',
      }),
    ).resolves.toMatchObject({
      created: true,
      block: {
        id: 'block-1',
        blockedUserId: 'user-blocked',
      },
    });

    expect(repository.create).toHaveBeenCalledWith({
      client: tx,
      blockerUserId: 'user-blocker',
      blockedUserId: 'user-blocked',
      note: '메모',
      now,
    });
    const appendBlockedEventInput = repository.appendBlockedEvent.mock.calls[0]?.[0];
    expect(appendBlockedEventInput).toMatchObject({
      client: tx,
      now,
    });
    expect(appendBlockedEventInput?.block.id).toBe('block-1');
    expect(sideEffectService.applyBlockCreated).toHaveBeenCalledWith({
      tx,
      seasonId: 'season-1',
      blockerUserId: 'user-blocker',
      blockedUserId: 'user-blocked',
      sourceBlockId: 'block-1',
      now,
    });
  });

  it('이미 active block이 있으면 side-effect를 다시 호출하지 않는다', async () => {
    repository.findActiveBetween.mockResolvedValue(block({ id: 'block-existing' }));

    await expect(
      command().execute({
        authUser,
        targetUserId: 'user-blocked',
        note: '새 메모',
      }),
    ).resolves.toMatchObject({
      created: false,
      block: { id: 'block-existing' },
    });

    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.appendBlockedEvent).not.toHaveBeenCalled();
    expect(sideEffectService.applyBlockCreated).not.toHaveBeenCalled();
  });

  it('concurrent create unique race는 active row 재조회 후 created=false로 수렴한다', async () => {
    prisma.runSerializableTransaction.mockRejectedValueOnce(makeUniqueError());
    repository.findActiveBetween.mockResolvedValueOnce(block({ id: 'block-existing' }));

    await expect(
      command().execute({
        authUser,
        targetUserId: 'user-blocked',
        note: '메모',
      }),
    ).resolves.toMatchObject({
      created: false,
      block: { id: 'block-existing' },
    });

    expect(repository.findActiveBetween).toHaveBeenLastCalledWith({
      blockerUserId: 'user-blocker',
      blockedUserId: 'user-blocked',
    });
    expect(sideEffectService.applyBlockCreated).not.toHaveBeenCalled();
  });
});
