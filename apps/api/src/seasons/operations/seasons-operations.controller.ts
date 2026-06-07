import { Body, Controller, Delete, Param, Patch } from '@nestjs/common';
import { campusSchema } from '@repo/shared/identity-contract';
import {
  clearSeasonOverrideRequestSchema,
  updateSeasonOverrideRequestSchema,
  updateSeasonScheduleRequestSchema,
} from '@repo/shared/season/operations';
import { RequireCapability } from '../../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { parsePathParam, parseRequestBody } from '../../platform/http/zod-request.js';
import { ClearSeasonOverrideCommand } from './clear-season-override.command.js';
import { UpdateSeasonOverrideCommand } from './update-season-override.command.js';
import { UpdateSeasonScheduleCommand } from './update-season-schedule.command.js';

export const SEASON_OPERATIONS_WRITE_CAPABILITY = 'admin:season:operations:write';

@Controller('api/campuses/:campusCode/seasons')
@RequireCapability(SEASON_OPERATIONS_WRITE_CAPABILITY)
export class SeasonsOperationsController {
  constructor(
    private readonly updateSeasonScheduleCommand: UpdateSeasonScheduleCommand,
    private readonly updateSeasonOverrideCommand: UpdateSeasonOverrideCommand,
    private readonly clearSeasonOverrideCommand: ClearSeasonOverrideCommand,
  ) {}

  @Patch(':seasonId/schedule')
  updateSchedule(
    @CurrentUser() actor: AuthenticatedUserContext,
    @Param('campusCode') campusCode: string,
    @Param('seasonId') seasonId: string,
    @Body() body: unknown,
  ) {
    const parsedCampus = parseSeasonOperationsCampusParam(campusCode);
    const parsed = parseRequestBody(updateSeasonScheduleRequestSchema, body);
    return this.updateSeasonScheduleCommand.execute(parsedCampus, seasonId, parsed, actor);
  }

  @Patch(':seasonId/override')
  updateOverride(
    @CurrentUser() actor: AuthenticatedUserContext,
    @Param('campusCode') campusCode: string,
    @Param('seasonId') seasonId: string,
    @Body() body: unknown,
  ) {
    const parsedCampus = parseSeasonOperationsCampusParam(campusCode);
    const parsed = parseRequestBody(updateSeasonOverrideRequestSchema, body);
    return this.updateSeasonOverrideCommand.execute(parsedCampus, seasonId, parsed, actor);
  }

  @Delete(':seasonId/override')
  clearOverride(
    @CurrentUser() actor: AuthenticatedUserContext,
    @Param('campusCode') campusCode: string,
    @Param('seasonId') seasonId: string,
    @Body() body: unknown,
  ) {
    const parsedCampus = parseSeasonOperationsCampusParam(campusCode);
    const parsed = parseRequestBody(clearSeasonOverrideRequestSchema, body ?? {});
    return this.clearSeasonOverrideCommand.execute(parsedCampus, seasonId, parsed, actor);
  }
}

function parseSeasonOperationsCampusParam(campusCode: string) {
  return parsePathParam(campusSchema, campusCode, {
    code: 'SEASONS_INVALID_CAMPUS_PARAM',
    errorMessage: 'campusCode 경로 파라미터 값이 올바르지 않습니다.',
    fieldName: 'campusCode',
  });
}
