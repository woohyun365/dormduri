import { BlockVisibilityQuery } from './block-visibility.query.js';

describe('BlockVisibilityQuery', () => {
  it('viewer가 block한 target과 target이 viewer를 block한 경우를 모두 excluded set으로 반환한다', async () => {
    const prisma = {
      userBlock: {
        findMany: jest.fn().mockResolvedValue([
          { blockerUserId: 'viewer-user', blockedUserId: 'target-a' },
          { blockerUserId: 'target-b', blockedUserId: 'viewer-user' },
        ]),
      },
    };
    const query = new BlockVisibilityQuery(prisma as never);

    const result = await query.getExcludedTargetUserIds({
      viewerUserId: 'viewer-user',
      targetUserIds: ['target-a', 'target-b', 'target-c', 'target-a'],
    });

    expect(prisma.userBlock.findMany).toHaveBeenCalledWith({
      where: {
        unblockedAt: null,
        OR: [
          {
            blockerUserId: 'viewer-user',
            blockedUserId: { in: ['target-a', 'target-b', 'target-c'] },
          },
          {
            blockerUserId: { in: ['target-a', 'target-b', 'target-c'] },
            blockedUserId: 'viewer-user',
          },
        ],
      },
      select: {
        blockerUserId: true,
        blockedUserId: true,
      },
    });
    expect(result).toEqual(new Set(['target-a', 'target-b']));
  });

  it('target subset이 비어 있으면 DB를 조회하지 않는다', async () => {
    const prisma = {
      userBlock: {
        findMany: jest.fn(),
      },
    };
    const query = new BlockVisibilityQuery(prisma as never);

    await expect(
      query.getExcludedTargetUserIds({ viewerUserId: 'viewer-user', targetUserIds: [] }),
    ).resolves.toEqual(new Set());
    expect(prisma.userBlock.findMany).not.toHaveBeenCalled();
  });
});
