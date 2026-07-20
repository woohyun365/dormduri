import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeasonParticipantPublicTargetOwner } from './registration-snapshot.query.js';

describe('registration-snapshot.query', () => {
  const prisma = {
    seasonParticipantProfileHistory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registration snapshot participant set은 SEASON_REGISTRATION + registeredAtSnapshot 조건만 본다', async () => {
    prisma.seasonParticipantProfileHistory.findMany.mockResolvedValue([
      { participantId: 'participant-1' },
      { participantId: 'participant-2' },
    ]);
    const owner = createSeasonParticipantPublicTargetOwner(prisma as never);

    const result = await owner.findRegistrationSnapshotParticipantIdSet([
      'participant-1',
      'participant-1',
      'participant-2',
    ]);

    expect(result).toEqual(new Set(['participant-1', 'participant-2']));
    expect(prisma.seasonParticipantProfileHistory.findMany).toHaveBeenCalledWith({
      where: {
        participantId: { in: ['participant-1', 'participant-2'] },
        source: 'SEASON_REGISTRATION',
        registeredAtSnapshot: { not: null },
        redactedAt: null,
      },
      select: { participantId: true },
    });
  });

  it('빈 participant 목록은 DB를 조회하지 않고 빈 set으로 닫는다', async () => {
    const owner = createSeasonParticipantPublicTargetOwner(prisma as never);

    await expect(owner.findRegistrationSnapshotParticipantIdSet([])).resolves.toEqual(new Set());
    expect(prisma.seasonParticipantProfileHistory.findMany).not.toHaveBeenCalled();
  });

  it('단일 public action target도 registration snapshot을 explicit하게 확인한다', async () => {
    prisma.seasonParticipantProfileHistory.findFirst.mockResolvedValue({ participantId: 'target' });
    const owner = createSeasonParticipantPublicTargetOwner(prisma as never);

    await expect(owner.hasRegistrationSnapshotForParticipant('target')).resolves.toBe(true);
    expect(prisma.seasonParticipantProfileHistory.findFirst).toHaveBeenCalledWith({
      where: {
        participantId: 'target',
        source: 'SEASON_REGISTRATION',
        registeredAtSnapshot: { not: null },
        redactedAt: null,
      },
      select: { participantId: true },
    });
  });
});
