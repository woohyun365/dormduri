import { BadRequestException, RequestMethod } from '@nestjs/common';
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

function getBadRequestResponse(error: unknown) {
  expect(error).toBeInstanceOf(BadRequestException);

  if (!(error instanceof BadRequestException)) {
    throw new Error('Expected BadRequestException');
  }

  const response = error.getResponse();
  expect(typeof response).toBe('object');
  expect(response).not.toBeNull();

  if (typeof response !== 'object' || response === null) {
    throw new Error('Expected object response');
  }

  return response as { code: string };
}

describe('SeasonsOperationsController', () => {
  const actor = {
    id: 'admin-user-1',
    gender: 'MALE',
    campus: 'CHUNCHEON',
    capabilities: [SEASON_OPERATIONS_WRITE_CAPABILITY],
  };
  const updateSeasonScheduleCommand = { execute: jest.fn() };
  const updateSeasonOverrideCommand = { execute: jest.fn() };
  const clearSeasonOverrideCommand = { execute: jest.fn() };
  const controller = new SeasonsOperationsController(
    updateSeasonScheduleCommand as never,
    updateSeasonOverrideCommand as never,
    clearSeasonOverrideCommand as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('schedule request body를 shared contract로 검증한 뒤 command에 위임한다', async () => {
    updateSeasonScheduleCommand.execute.mockResolvedValue({ auditEventId: 'audit-1' });

    await expect(
      controller.updateSchedule(actor as never, 'CHUNCHEON', 'season-1', {
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        preparationStartDate: '2026-02-01',
        matchingStartDate: '2026-02-10',
        seasonEndDate: '2026-02-28',
      }),
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

  it('invalid operations request는 field-aware BadRequest로 막는다', () => {
    try {
      void controller.updateOverride(actor as never, 'CHUNCHEON', 'season-1', {
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        state: 'SEASON_MATCHING',
      });
      throw new Error('Expected updateOverride to throw');
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.code).toBe('INVALID_REQUEST_BODY');
      expect(updateSeasonOverrideCommand.execute).not.toHaveBeenCalled();
    }
  });

  it('invalid campus path param은 command 실행 전에 막는다', () => {
    try {
      void controller.updateSchedule(actor as never, 'INVALID', 'season-1', {
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        preparationStartDate: '2026-02-01',
        matchingStartDate: '2026-02-10',
        seasonEndDate: '2026-02-28',
      });
      throw new Error('Expected updateSchedule to throw');
    } catch (error) {
      const response = getBadRequestResponse(error);

      expect(response.code).toBe('SEASONS_INVALID_CAMPUS_PARAM');
      expect(updateSeasonScheduleCommand.execute).not.toHaveBeenCalled();
    }
  });

  it('clear override는 DELETE body를 shared contract로 검증한다', async () => {
    clearSeasonOverrideCommand.execute.mockResolvedValue({ auditEventId: 'audit-2' });

    await expect(
      controller.clearOverride(actor as never, 'CHUNCHEON', 'season-1', {
        expectedUpdatedAt: '2026-01-01T00:00:00.000Z',
        reason: 'resolved',
      }),
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
