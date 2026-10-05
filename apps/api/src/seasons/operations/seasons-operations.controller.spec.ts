import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RequestMethod } from '@nestjs/common';
import {
  AUTH_ACCESS_METADATA_KEY,
  AUTH_REQUIRED_CAPABILITIES_METADATA_KEY,
} from '../../auth/access/auth-access.decorator.js';
import {
  SEASON_OPERATIONS_WRITE_CAPABILITY,
  SeasonsOperationsController,
} from './seasons-operations.controller.js';

const NEST_CONTROLLER_PATH_METADATA = 'path';
const NEST_ROUTE_PATH_METADATA = 'path';
const NEST_ROUTE_METHOD_METADATA = 'method';

function getRouteHandler(handler: keyof SeasonsOperationsController) {
  const methodRef = Object.getOwnPropertyDescriptor(SeasonsOperationsController.prototype, handler)
    ?.value as object | undefined;

  if (!methodRef) {
    throw new Error(`Expected SeasonsOperationsController.${String(handler)} handler`);
  }

  return methodRef;
}

describe('SeasonsOperationsController', () => {
  const actor = {
    id: 'admin-user-1',
    gender: 'MALE',
    campus: 'CHUNCHEON',
    capabilities: [SEASON_OPERATIONS_WRITE_CAPABILITY],
  };
  const updateSeasonScheduleCommand = { execute: vi.fn() };
  const updateSeasonOverrideCommand = { execute: vi.fn() };
  const clearSeasonOverrideCommand = { execute: vi.fn() };
  const controller = new SeasonsOperationsController(
    updateSeasonScheduleCommand as never,
    updateSeasonOverrideCommand as never,
    clearSeasonOverrideCommand as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('operations route shape와 admin capability metadata를 고정한다', () => {
    expect(Reflect.getMetadata(NEST_CONTROLLER_PATH_METADATA, SeasonsOperationsController)).toBe(
      'api/campuses/:campusCode/seasons',
    );
    expect(Reflect.getMetadata(AUTH_ACCESS_METADATA_KEY, SeasonsOperationsController)).toBe(
      'protected',
    );
    expect(
      Reflect.getMetadata(AUTH_REQUIRED_CAPABILITIES_METADATA_KEY, SeasonsOperationsController),
    ).toEqual([SEASON_OPERATIONS_WRITE_CAPABILITY]);

    expect(Reflect.getMetadata(NEST_ROUTE_METHOD_METADATA, getRouteHandler('updateSchedule'))).toBe(
      RequestMethod.PATCH,
    );
    expect(Reflect.getMetadata(NEST_ROUTE_PATH_METADATA, getRouteHandler('updateSchedule'))).toBe(
      ':seasonId/schedule',
    );
    expect(Reflect.getMetadata(NEST_ROUTE_METHOD_METADATA, getRouteHandler('updateOverride'))).toBe(
      RequestMethod.PATCH,
    );
    expect(Reflect.getMetadata(NEST_ROUTE_PATH_METADATA, getRouteHandler('updateOverride'))).toBe(
      ':seasonId/override',
    );
    expect(Reflect.getMetadata(NEST_ROUTE_METHOD_METADATA, getRouteHandler('clearOverride'))).toBe(
      RequestMethod.DELETE,
    );
    expect(Reflect.getMetadata(NEST_ROUTE_PATH_METADATA, getRouteHandler('clearOverride'))).toBe(
      ':seasonId/override',
    );
  });

  it('schedule request body를 parsed input으로 command에 위임한다', async () => {
    updateSeasonScheduleCommand.execute.mockResolvedValue({ auditEventId: 'audit-1' });

    await expect(
      controller.updateSchedule(
        actor as never,
        {
          campusCode: 'CHUNCHEON',
          body: {
            expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
            preparationStartDate: '2026-02-01',
            matchingStartDate: '2026-02-10',
            seasonEndDate: '2026-02-28',
          },
        },
        'season-1',
      ),
    ).resolves.toEqual({ auditEventId: 'audit-1' });
    expect(updateSeasonScheduleCommand.execute).toHaveBeenCalledWith(
      'CHUNCHEON',
      'season-1',
      {
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        preparationStartDate: '2026-02-01',
        matchingStartDate: '2026-02-10',
        seasonEndDate: '2026-02-28',
      },
      actor,
    );
  });

  it('clear override는 parsed DELETE body를 command에 위임한다', async () => {
    clearSeasonOverrideCommand.execute.mockResolvedValue({ auditEventId: 'audit-2' });

    await expect(
      controller.clearOverride(
        actor as never,
        {
          campusCode: 'CHUNCHEON',
          body: {
            expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
            reason: 'resolved',
          },
        },
        'season-1',
      ),
    ).resolves.toEqual({ auditEventId: 'audit-2' });
    expect(clearSeasonOverrideCommand.execute).toHaveBeenCalledWith(
      'CHUNCHEON',
      'season-1',
      {
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        reason: 'resolved',
      },
      actor,
    );
  });
});
