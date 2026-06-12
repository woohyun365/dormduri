import { describe, expect, it, vi } from 'vitest';
import { Campus, Gender } from '../../generated/prisma/enums.js';
import { SeasonOperationsAuditRepository } from './season-operations-audit.repository.js';

const previousSeason = {
  id: 'season-1',
  campusCode: Campus.CHUNCHEON,
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

const nextSeason = {
  ...previousSeason,
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  matchingStartDate: new Date('2026-02-12T00:00:00.000Z'),
};

interface AuditCreateInput {
  data: {
    seasonId: string;
    campusCode: string;
    action: string;
    actorUserId: string;
    actorCapabilities: readonly string[];
    reason: string | null;
    previousSnapshot: unknown;
    nextSnapshot: unknown;
    metadata?: unknown;
  };
  select: { id: true };
}

describe('SeasonOperationsAuditRepository', () => {
  it('운영 audit payload는 actor id/capability와 season snapshot allowlist만 저장한다', async () => {
    const create = vi.fn<(arg0: AuditCreateInput) => Promise<{ id: string }>>().mockResolvedValue({
      id: 'audit-1',
    });
    const client = {
      seasonOperationAuditEvent: {
        create,
      },
    };
    const repository = new SeasonOperationsAuditRepository();

    await repository.append({
      client: client as never,
      action: 'UPDATE_SCHEDULE',
      actor: {
        id: 'admin-user-1',
        sessionId: 'session-1',
        actorId: 'admin-user-1',
        actorType: 'USER',
        gender: Gender.M,
        campus: 'CHUNCHEON',
        capabilities: ['admin:season:operations:write'],
      },
      seasonId: 'season-1',
      reason: 'academic calendar changed',
      previousSeason,
      nextSeason,
      metadata: {
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        seasonId: 'season-1',
        campusCode: 'CHUNCHEON',
        action: 'UPDATE_SCHEDULE',
        actorUserId: 'admin-user-1',
        actorCapabilities: ['admin:season:operations:write'],
        reason: 'academic calendar changed',
        previousSnapshot: {
          campusCode: 'CHUNCHEON',
          season: {
            id: 'season-1',
            name: '2026-1',
            preparationStartDate: '2026-02-01',
            matchingStartDate: '2026-02-10',
            seasonEndDate: '2026-02-28',
          },
          updatedAt: '2026-01-01T00:00:00.000Z',
          override: {
            active: false,
            state: null,
            reason: null,
            startedAt: null,
            endsAt: null,
          },
        },
        nextSnapshot: {
          campusCode: 'CHUNCHEON',
          season: {
            id: 'season-1',
            name: '2026-1',
            preparationStartDate: '2026-02-01',
            matchingStartDate: '2026-02-12',
            seasonEndDate: '2026-02-28',
          },
          updatedAt: '2026-01-02T00:00:00.000Z',
          override: {
            active: false,
            state: null,
            reason: null,
            startedAt: null,
            endsAt: null,
          },
        },
        metadata: {
          expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
      select: { id: true },
    });

    const createInput = create.mock.calls[0]?.[0];
    if (!createInput) {
      throw new Error('Expected audit create call');
    }

    expect(JSON.stringify(createInput.data)).not.toContain('session-1');
    expect(JSON.stringify(createInput.data)).not.toContain('MALE');
  });
});
