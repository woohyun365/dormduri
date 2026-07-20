import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import {
  selectedDormitorySubmitRequestSchema,
  seasonRegistrationFinalizeRequestSchema,
  seasonRegistrationFinalizeResponseSchema,
  updateSeasonProfileRequestSchema,
} from '@repo/shared/season/participation';
import { RequireCapability } from '../auth/access/auth-access.decorator.js';
import { CurrentUser } from '../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { forbiddenError } from '../platform/http/api-error.js';
import { parsePathParam, parseRequestBody } from '../platform/http/zod-request.js';
import { RequireCurrentSeasonParticipant, SeasonParticipant } from './context/index.js';
import {
  SeasonParticipantsService,
  type CurrentSeasonParticipantRecord,
} from './application/season-participants.service.js';

@Controller('api/seasons/current/profile')
@RequireCapability()
export class CurrentSeasonProfileController {
  constructor(private readonly seasonParticipantsService: SeasonParticipantsService) {}

  @Get()
  async getCurrentSeasonProfile(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.seasonParticipantsService.getCurrentSeasonProfile(authUser.id);
  }

  @Put()
  @RequireCurrentSeasonParticipant('season-profile-draft-not-allowed')
  async createOrUpdateSeasonProfileDraft(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
    @SeasonParticipant() seasonParticipant?: CurrentSeasonParticipantRecord,
  ) {
    const parsed = parseRequestBody(updateSeasonProfileRequestSchema, body);
    return this.seasonParticipantsService.createOrUpdateSeasonProfileDraft(
      resolveSeasonParticipantActorUserId(authUser, seasonParticipant),
      parsed,
    );
  }
}

@Controller('api/seasons/previous/profile')
@RequireCapability()
export class PreviousSeasonProfileController {
  constructor(private readonly seasonParticipantsService: SeasonParticipantsService) {}

  @Get()
  async getPreviousSeasonProfile(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.seasonParticipantsService.getPreviousSeasonProfile(authUser.id);
  }
}

@Controller('api/seasons/:seasonId/profile/me')
@RequireCapability()
export class SeasonProfileHistoryController {
  constructor(private readonly seasonParticipantsService: SeasonParticipantsService) {}

  @Get()
  async getSeasonProfileHistory(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Param('seasonId') seasonId: string,
  ) {
    const parsedSeasonId = parsePathParam(
      seasonRegistrationFinalizeResponseSchema.shape.seasonId,
      seasonId,
      {
        code: 'INVALID_SEASON_ID',
        errorMessage: '시즌 식별자가 올바르지 않습니다.',
        fieldName: 'seasonId',
      },
    );
    return this.seasonParticipantsService.getSeasonProfileHistory(authUser.id, parsedSeasonId);
  }
}

@Controller('api/seasons/current/participation')
@RequireCapability()
export class CurrentSeasonParticipationController {
  constructor(private readonly seasonParticipantsService: SeasonParticipantsService) {}

  @Get('selectable-dormitories')
  async listSelectableDormitories(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.seasonParticipantsService.listSelectableDormitoriesForCurrentSeason(authUser.id);
  }

  @Post('dormitory-selection')
  @RequireCurrentSeasonParticipant('season-profile-draft-not-allowed')
  async createOrUpdateDormitorySelection(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
    @SeasonParticipant() seasonParticipant?: CurrentSeasonParticipantRecord,
  ) {
    const parsed = parseRequestBody(selectedDormitorySubmitRequestSchema, body);
    return this.seasonParticipantsService.createOrUpdateDormitorySelection(
      resolveSeasonParticipantActorUserId(authUser, seasonParticipant),
      parsed,
    );
  }

  @Post('registration')
  @RequireCurrentSeasonParticipant('registration-not-allowed')
  async finalizeSeasonRegistration(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
    @SeasonParticipant() seasonParticipant?: CurrentSeasonParticipantRecord,
  ) {
    parseRequestBody(seasonRegistrationFinalizeRequestSchema, body ?? {});
    return this.seasonParticipantsService.finalizeSeasonRegistration(
      resolveSeasonParticipantActorUserId(authUser, seasonParticipant),
    );
  }

  @Post('deregister')
  async deregister(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.seasonParticipantsService.deregisterCurrentSeasonParticipation(authUser.id);
  }
}

function resolveSeasonParticipantActorUserId(
  authUser: AuthenticatedUserContext,
  seasonParticipant: CurrentSeasonParticipantRecord | null | undefined,
) {
  if (!seasonParticipant) {
    return authUser.id;
  }

  if (seasonParticipant.userId !== authUser.id) {
    throw forbiddenError(
      'CURRENT_SEASON_PARTICIPANT_ACTOR_MISMATCH',
      '현재 시즌 참여자 컨텍스트와 로그인 사용자가 일치하지 않습니다.',
    );
  }

  return authUser.id;
}
