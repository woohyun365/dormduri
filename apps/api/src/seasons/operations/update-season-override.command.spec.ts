import { describe, expect, it, vi } from 'vitest';
import { ClearSeasonOverrideCommand } from './clear-season-override.command.js';
import { UpdateSeasonOverrideCommand } from './update-season-override.command.js';

const actor = {
  id: 'admin-user-1',
  email: 'admin@example.com',
  campus: 'CHUNCHEON',
  capabilities: ['admin:season:operations:write'],
} as const;

interface TestSeasonOperationRecord {
  id: string;
  campusCode: string;
  name: string;
  preparationStartDate: Date;
  matchingStartDate: Date;
  seasonEndDate: Date;
  updatedAt: Date;
  overrideState: string | null;
  overrideReason: string | null;
  overrideStartedAt: Date | null;
  overrideEndsAt: Date | null;
}

const beforeSeason: TestSeasonOperationRecord = {
  id: 'season-1',
  campusCode: 'CHUNCHEON',
  name: '2026-1',
  preparationStartDate: new Date('2026-02-01T00:00:00.000Z'),
  matchingStartDate: new Date('2026-02-10T00:00:00.000Z'),
  seasonEndDate: new Date('2026-02-28T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  overrideState: null,
  overrideReason: null,
  overrideStartedAt: null,
  overrideEndsAt: null,
};

const afterOverride: TestSeasonOperationRecord = {
  ...beforeSeason,
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  overrideState: 'SEASON_MATCHING',
  overrideReason: 'incident response',
  overrideStartedAt: new Date('2026-02-10T00:00:00.000Z'),
  overrideEndsAt: new Date('2026-02-12T00:00:00.000Z'),
};

function createRepository(after: TestSeasonOperationRecord = afterOverride) {
  const tx = { tx: true };
  const repository = {
    transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    findByCampusAndId: vi.fn().mockResolvedValueOnce(beforeSeason).mockResolvedValueOnce(after),
    updateOverrideIfVersionMatches: vi.fn().mockResolvedValue({ count: 1 }),
    clearOverrideIfVersionMatches: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const auditRepository = {
    append: vi.fn().mockResolvedValue({ id: 'audit-1' }),
  };
  const metrics = {
    recordOperation: vi.fn(),
  };

  return { tx, repository, auditRepository, metrics };
}

describe('season override commands', () => {
  it('override update는 version 조건 mutation과 audit를 같은 transaction client로 수행한다', async () => {
    const { tx, repository, auditRepository, metrics } = createRepository();
    const command = new UpdateSeasonOverrideCommand(
      repository as never,
      auditRepository,
      metrics as never,
    );

    const result = await command.execute(
      'CHUNCHEON',
      'season-1',
      {
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        state: 'SEASON_MATCHING',
        reason: 'incident response',
        startsAt: '2026-02-10T00:00:00.000Z',
        endsAt: '2026-02-12T00:00:00.000Z',
      },
      actor as never,
    );

    expect(repository.updateOverrideIfVersionMatches).toHaveBeenCalledWith(tx, {
      seasonId: 'season-1',
      campusCode: 'CHUNCHEON',
      expectedUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
      overrideState: 'SEASON_MATCHING',
      overrideReason: 'incident response',
      overrideStartedAt: new Date('2026-02-10T00:00:00.000Z'),
      overrideEndsAt: new Date('2026-02-12T00:00:00.000Z'),
    });
    expect(auditRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({ client: tx, action: 'UPDATE_OVERRIDE' }),
    );
    expect(result).toMatchObject({ auditEventId: 'audit-1', action: 'UPDATE_OVERRIDE' });
    expect(metrics.recordOperation).toHaveBeenCalledWith({
      action: 'UPDATE_OVERRIDE',
      campusCode: 'CHUNCHEON',
      outcome: 'success',
    });
  });

  it('override clear는 stored override를 null로 바꾸고 audit를 남긴다', async () => {
    const cleared = {
      ...afterOverride,
      overrideState: null,
      overrideReason: null,
      overrideStartedAt: null,
      overrideEndsAt: null,
    };
    const { tx, repository, auditRepository, metrics } = createRepository(cleared);
    const command = new ClearSeasonOverrideCommand(
      repository as never,
      auditRepository,
      metrics as never,
    );

    const result = await command.execute(
      'CHUNCHEON',
      'season-1',
      {
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        reason: 'incident resolved',
      },
      actor as never,
    );

    expect(repository.clearOverrideIfVersionMatches).toHaveBeenCalledWith(tx, {
      seasonId: 'season-1',
      campusCode: 'CHUNCHEON',
      expectedUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(auditRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({ client: tx, action: 'CLEAR_OVERRIDE' }),
    );
    expect(result).toMatchObject({ auditEventId: 'audit-1', action: 'CLEAR_OVERRIDE' });
    expect(metrics.recordOperation).toHaveBeenCalledWith({
      action: 'CLEAR_OVERRIDE',
      campusCode: 'CHUNCHEON',
      outcome: 'success',
    });
  });

  it('override update conflict와 validation failure metric을 기록한다', async () => {
    const { repository, auditRepository, metrics } = createRepository();
    const command = new UpdateSeasonOverrideCommand(
      repository as never,
      auditRepository,
      metrics as never,
    );

    repository.updateOverrideIfVersionMatches.mockResolvedValueOnce({ count: 0 });

    await expect(
      command.execute(
        'CHUNCHEON',
        'season-1',
        {
          expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
          state: 'SEASON_MATCHING',
          reason: 'incident response',
          startsAt: '2026-02-10T00:00:00.000Z',
          endsAt: '2026-02-12T00:00:00.000Z',
        },
        actor as never,
      ),
    ).rejects.toMatchObject({ response: { code: 'SEASONS_OPERATION_CONFLICT' } });
    expect(auditRepository.append).not.toHaveBeenCalled();
    expect(metrics.recordOperation).toHaveBeenCalledWith({
      action: 'UPDATE_OVERRIDE',
      campusCode: 'CHUNCHEON',
      outcome: 'conflict',
    });

    metrics.recordOperation.mockClear();
    await expect(
      Promise.resolve().then(() =>
        command.execute(
          'CHUNCHEON',
          'season-1',
          {
            expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
            state: 'SEASON_MATCHING',
            reason: 'incident response',
            startsAt: '2026-02-12T00:00:00.000Z',
            endsAt: '2026-02-10T00:00:00.000Z',
          },
          actor as never,
        ),
      ),
    ).rejects.toMatchObject({
      response: { code: 'SEASONS_OPERATION_INVALID_OVERRIDE_WINDOW' },
    });
    expect(metrics.recordOperation).toHaveBeenCalledWith({
      action: 'UPDATE_OVERRIDE',
      campusCode: 'CHUNCHEON',
      outcome: 'validation_failure',
    });
  });
});
