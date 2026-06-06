import { UpdateSeasonScheduleCommand } from './update-season-schedule.command.js';

const actor = {
  id: 'admin-user-1',
  email: 'admin@example.com',
  campus: 'CHUNCHEON',
  capabilities: ['admin:season:operations:write'],
} as const;

const beforeSeason = {
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

const afterSeason = {
  ...beforeSeason,
  matchingStartDate: new Date('2026-02-12T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

function createSubject() {
  const tx = { tx: true };
  const repository = {
    transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    findByCampusAndId: jest
      .fn()
      .mockResolvedValueOnce(beforeSeason)
      .mockResolvedValueOnce(afterSeason),
    updateScheduleIfVersionMatches: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const auditRepository = {
    append: jest.fn().mockResolvedValue({ id: 'audit-1' }),
  };

  return {
    tx,
    repository,
    auditRepository,
    command: new UpdateSeasonScheduleCommand(repository as never, auditRepository as never),
  };
}

describe('UpdateSeasonScheduleCommand', () => {
  it('expectedUpdatedAt optimistic concurrency와 audit append를 같은 transaction client로 수행한다', async () => {
    const { tx, repository, auditRepository, command } = createSubject();

    const result = await command.execute(
      'CHUNCHEON',
      'season-1',
      {
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        name: '2026 봄',
        preparationStartDate: '2026-02-01',
        matchingStartDate: '2026-02-12',
        seasonEndDate: '2026-02-28',
        reason: 'academic calendar changed',
      },
      actor as never,
    );

    expect(repository.updateScheduleIfVersionMatches).toHaveBeenCalledWith(tx, {
      seasonId: 'season-1',
      campusCode: 'CHUNCHEON',
      expectedUpdatedAt: new Date('2026-01-01T00:00:00.000Z'),
      name: '2026 봄',
      preparationStartDate: new Date('2026-02-01T00:00:00.000Z'),
      matchingStartDate: new Date('2026-02-12T00:00:00.000Z'),
      seasonEndDate: new Date('2026-02-28T00:00:00.000Z'),
    });
    expect(auditRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        client: tx,
        action: 'UPDATE_SCHEDULE',
        actor,
        seasonId: 'season-1',
        previousSeason: beforeSeason,
        nextSeason: afterSeason,
      }),
    );
    expect(result).toMatchObject({ auditEventId: 'audit-1', action: 'UPDATE_SCHEDULE' });
  });

  it('version conflict는 audit를 남기지 않고 fail-closed 처리한다', async () => {
    const { repository, auditRepository, command } = createSubject();
    repository.updateScheduleIfVersionMatches.mockResolvedValueOnce({ count: 0 });

    await expect(
      command.execute(
        'CHUNCHEON',
        'season-1',
        {
          expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
          preparationStartDate: '2026-02-01',
          matchingStartDate: '2026-02-12',
          seasonEndDate: '2026-02-28',
        },
        actor as never,
      ),
    ).rejects.toMatchObject({ response: { code: 'SEASONS_OPERATION_CONFLICT' } });
    expect(auditRepository.append).not.toHaveBeenCalled();
  });

  it('campusCode + seasonId로 season을 찾지 못하면 다른 campus season을 수정하지 않는다', async () => {
    const { repository, auditRepository, command } = createSubject();
    repository.findByCampusAndId.mockReset().mockResolvedValueOnce(null);

    await expect(
      command.execute(
        'CHUNCHEON',
        'season-1',
        {
          expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
          preparationStartDate: '2026-02-01',
          matchingStartDate: '2026-02-12',
          seasonEndDate: '2026-02-28',
        },
        actor as never,
      ),
    ).rejects.toMatchObject({ response: { code: 'SEASONS_OPERATION_NOT_FOUND' } });
    expect(repository.updateScheduleIfVersionMatches).not.toHaveBeenCalled();
    expect(auditRepository.append).not.toHaveBeenCalled();
  });

  it('audit append 실패는 command 실패로 전파되어 transaction rollback 대상이 된다', async () => {
    const { auditRepository, command } = createSubject();
    auditRepository.append.mockRejectedValueOnce(new Error('audit write failed'));

    await expect(
      command.execute(
        'CHUNCHEON',
        'season-1',
        {
          expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
          preparationStartDate: '2026-02-01',
          matchingStartDate: '2026-02-12',
          seasonEndDate: '2026-02-28',
        },
        actor as never,
      ),
    ).rejects.toThrow('audit write failed');
  });
});
