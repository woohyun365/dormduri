import {
  createParamDecorator,
  Controller,
  Delete,
  Param,
  Patch,
  type ExecutionContext,
} from '@nestjs/common';
import { campusSchema, type Campus } from '@repo/shared/identity/primitives';
import {
  clearSeasonOverrideRequestSchema,
  updateSeasonOverrideRequestSchema,
  updateSeasonScheduleRequestSchema,
  type UpdateSeasonScheduleRequest,
  type UpdateSeasonOverrideRequest,
  type ClearSeasonOverrideRequest,
} from '@repo/shared/season/operations';
import { RequireCapability } from '../../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { parsePathParam, parseRequestBody } from '../../platform/http/zod-request.js';
import { ZodRequestPipe } from '../../platform/http/zod-request.pipe.js';
import { ClearSeasonOverrideCommand } from './clear-season-override.command.js';
import { UpdateSeasonOverrideCommand } from './update-season-override.command.js';
import { UpdateSeasonScheduleCommand } from './update-season-schedule.command.js';

export const SEASON_OPERATIONS_WRITE_CAPABILITY = 'admin:season:operations:write';

interface RawSeasonOperation {
  campusCode: string;
  body: unknown;
}
// One ordered pipe preserves path-before-body errors; extraction does not validate.
const SeasonOperation = createParamDecorator(
  (_: unknown, context: ExecutionContext): RawSeasonOperation => {
    const request = context
      .switchToHttp()
      .getRequest<{ params: { campusCode: string }; body?: unknown }>();
    return { campusCode: request.params.campusCode, body: request.body };
  },
);

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
    @SeasonOperation(
      new ZodRequestPipe((input: RawSeasonOperation) => {
        const parsedCampus = parseSeasonOperationsCampusParam(input.campusCode);
        const parsed = parseRequestBody(updateSeasonScheduleRequestSchema, input.body);
        return { campusCode: parsedCampus, body: parsed };
      }),
    )
    input: { campusCode: Campus; body: UpdateSeasonScheduleRequest },
    @Param('seasonId') seasonId: string,
  ) {
    return this.updateSeasonScheduleCommand.execute(input.campusCode, seasonId, input.body, actor);
  }

  @Patch(':seasonId/override')
  updateOverride(
    @CurrentUser() actor: AuthenticatedUserContext,
    @SeasonOperation(
      new ZodRequestPipe((input: RawSeasonOperation) => {
        const parsedCampus = parseSeasonOperationsCampusParam(input.campusCode);
        const parsed = parseRequestBody(updateSeasonOverrideRequestSchema, input.body);
        return { campusCode: parsedCampus, body: parsed };
      }),
    )
    input: { campusCode: Campus; body: UpdateSeasonOverrideRequest },
    @Param('seasonId') seasonId: string,
  ) {
    return this.updateSeasonOverrideCommand.execute(input.campusCode, seasonId, input.body, actor);
  }

  @Delete(':seasonId/override')
  clearOverride(
    @CurrentUser() actor: AuthenticatedUserContext,
    @SeasonOperation(
      new ZodRequestPipe((input: RawSeasonOperation) => {
        const parsedCampus = parseSeasonOperationsCampusParam(input.campusCode);
        const parsed = parseRequestBody(clearSeasonOverrideRequestSchema, input.body ?? {});
        return { campusCode: parsedCampus, body: parsed };
      }),
    )
    input: { campusCode: Campus; body: ClearSeasonOverrideRequest },
    @Param('seasonId') seasonId: string,
  ) {
    return this.clearSeasonOverrideCommand.execute(input.campusCode, seasonId, input.body, actor);
  }
}

function parseSeasonOperationsCampusParam(campusCode: string) {
  return parsePathParam(campusSchema, campusCode, {
    code: 'SEASONS_INVALID_CAMPUS_PARAM',
    errorMessage: 'campusCode 경로 파라미터 값이 올바르지 않습니다.',
    fieldName: 'campusCode',
  });
}
