import { describe, expect, it, vi } from 'vitest';
import { MatchRequestSearchMetadataQuery } from './match-request-search-metadata.query.js';

describe('MatchRequestSearchMetadataQuery', () => {
  it('live pending 요청을 viewer 기준 direction으로 target participant map에 담는다', async () => {
    const now = new Date('2026-06-08T00:00:00.000Z');
    const expiresAt = new Date('2026-06-13T00:00:00.000Z');
    const prisma = {
      $queryRawTyped: vi.fn().mockResolvedValue([
        {
          id: 'request-sent',
          targetParticipantId: 'target-sent',
          direction: 'SENT',
          createdAt: now,
          expiresAt,
        },
        {
          id: 'request-received',
          targetParticipantId: 'target-received',
          direction: 'RECEIVED',
          createdAt: now,
          expiresAt,
        },
        {
          id: 'request-invalid',
          targetParticipantId: null,
          direction: null,
          createdAt: now,
          expiresAt,
        },
      ]),
    };
    const query = new MatchRequestSearchMetadataQuery(prisma as never);

    const result = await query.getLivePendingRequestMetadata({
      seasonId: 'season-1',
      viewerParticipantId: 'viewer-participant',
      targetParticipantIds: ['target-sent', 'target-received', 'target-sent'],
      now,
    });

    expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1);
    expect([...result.entries()]).toEqual([
      [
        'target-sent',
        {
          requestId: 'request-sent',
          direction: 'SENT',
          createdAt: now,
          expiresAt,
        },
      ],
      [
        'target-received',
        {
          requestId: 'request-received',
          direction: 'RECEIVED',
          createdAt: now,
          expiresAt,
        },
      ],
    ]);
  });

  it('target이 없으면 SQL을 실행하지 않는다', async () => {
    const prisma = {
      $queryRawTyped: vi.fn(),
    };
    const query = new MatchRequestSearchMetadataQuery(prisma as never);

    await expect(
      query.getLivePendingRequestMetadata({
        seasonId: 'season-1',
        viewerParticipantId: 'viewer-participant',
        targetParticipantIds: [],
        now: new Date('2026-06-08T00:00:00.000Z'),
      }),
    ).resolves.toEqual(new Map());
    expect(prisma.$queryRawTyped).not.toHaveBeenCalled();
  });

  it('viewer to target 방향 요청 횟수 초과 target metadata를 담는다', async () => {
    const prisma = {
      $queryRawTyped: vi.fn().mockResolvedValue([
        {
          targetParticipantId: 'target-limit',
          directionCount: 5,
        },
        {
          targetParticipantId: 'target-invalid',
          directionCount: null,
        },
      ]),
    };
    const query = new MatchRequestSearchMetadataQuery(prisma as never);

    const result = await query.getDirectionLimitReachedMetadata({
      seasonId: 'season-1',
      viewerParticipantId: 'viewer-participant',
      targetParticipantIds: ['target-limit', 'target-limit', 'target-other'],
    });

    expect(prisma.$queryRawTyped).toHaveBeenCalledTimes(1);
    expect([...result.entries()]).toEqual([
      [
        'target-limit',
        {
          targetParticipantId: 'target-limit',
          directionCount: 5,
        },
      ],
    ]);
  });

  it('direction limit target이 없으면 SQL을 실행하지 않는다', async () => {
    const prisma = {
      $queryRawTyped: vi.fn(),
    };
    const query = new MatchRequestSearchMetadataQuery(prisma as never);

    await expect(
      query.getDirectionLimitReachedMetadata({
        seasonId: 'season-1',
        viewerParticipantId: 'viewer-participant',
        targetParticipantIds: [],
      }),
    ).resolves.toEqual(new Map());
    expect(prisma.$queryRawTyped).not.toHaveBeenCalled();
  });

  it('유효한 보낸 pending 요청 3건부터 viewer-level 생성 capability를 닫는다', async () => {
    const now = new Date('2026-06-08T00:00:00.000Z');
    const prisma = {
      matchRequest: { count: vi.fn().mockResolvedValue(3) },
    };
    const query = new MatchRequestSearchMetadataQuery(prisma as never);

    await expect(
      query.isPendingSentLimitReached({
        seasonId: 'season-1',
        viewerParticipantId: 'viewer-participant',
        now,
      }),
    ).resolves.toBe(true);
    expect(prisma.matchRequest.count).toHaveBeenCalledWith({
      where: {
        seasonId: 'season-1',
        requesterParticipantId: 'viewer-participant',
        status: 'PENDING',
        expiresAt: { gt: now },
      },
    });
  });

  it('terminal request와 unmatched relation의 최신 시각으로 target별 cooldown을 계산한다', async () => {
    const now = new Date('2026-06-10T00:00:00.000Z');
    const prisma = {
      matchRequest: {
        findMany: vi.fn().mockResolvedValue([
          {
            receiverParticipantId: 'target-request',
            terminalAt: new Date('2026-06-09T00:00:00.000Z'),
          },
          {
            receiverParticipantId: 'target-old',
            terminalAt: new Date('2026-06-01T00:00:00.000Z'),
          },
        ]),
      },
      activeMatch: {
        findMany: vi.fn().mockResolvedValue([
          {
            endedAt: new Date('2026-06-09T12:00:00.000Z'),
            createdFromRequest: { receiverParticipantId: 'target-unmatched' },
          },
        ]),
      },
    };
    const query = new MatchRequestSearchMetadataQuery(prisma as never);

    await expect(
      query.getDirectionCooldownActiveTargetIds({
        seasonId: 'season-1',
        viewerParticipantId: 'viewer-participant',
        targetParticipantIds: ['target-request', 'target-unmatched', 'target-old'],
        now,
      }),
    ).resolves.toEqual(new Set(['target-request', 'target-unmatched']));
  });
});
