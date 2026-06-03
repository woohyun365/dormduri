import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import {
  selectedDormitorySubmitRequestSchema,
  seasonRegistrationFinalizeRequestSchema,
  updateSeasonProfileRequestSchema,
} from '@repo/shared/season-contract';
import { RequireCapability } from '../auth/auth-access.decorator.js';
import { CurrentUser } from '../auth/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { forbiddenError } from '../common/http/api-error.js';
import { parseRequestBody } from '../common/http/zod-request.js';
import {
  RequireCurrentSeasonParticipant,
  SeasonParticipant,
} from './current-season-participant-context.decorator.js';
import {
  SeasonParticipantsService,
  type CurrentSeasonParticipantRecord,
} from './season-participants.service.js';

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
