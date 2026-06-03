import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import {
  selectedDormitorySubmitRequestSchema,
  seasonRegistrationFinalizeRequestSchema,
  updateSeasonProfileRequestSchema,
} from '@repo/shared/season-contract';
import { RequireCapability } from '../auth/auth-access.decorator.js';
import { CurrentUser } from '../auth/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { parseRequestBody } from '../common/http/zod-request.js';
import { SeasonParticipantsService } from './season-participants.service.js';

@Controller('api/seasons/current/profile')
@RequireCapability()
export class CurrentSeasonProfileController {
  constructor(private readonly seasonParticipantsService: SeasonParticipantsService) {}

  @Get()
  async getCurrentSeasonProfile(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.seasonParticipantsService.getCurrentSeasonProfile(authUser.id);
  }

  @Put()
  async createOrUpdateSeasonProfileDraft(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    const parsed = parseRequestBody(updateSeasonProfileRequestSchema, body);
    return this.seasonParticipantsService.createOrUpdateSeasonProfileDraft(authUser.id, parsed);
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
  async createOrUpdateDormitorySelection(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    const parsed = parseRequestBody(selectedDormitorySubmitRequestSchema, body);
    return this.seasonParticipantsService.createOrUpdateDormitorySelection(authUser.id, parsed);
  }

  @Post('registration')
  async finalizeSeasonRegistration(
    @CurrentUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    parseRequestBody(seasonRegistrationFinalizeRequestSchema, body ?? {});
    return this.seasonParticipantsService.finalizeSeasonRegistration(authUser.id);
  }

  @Post('deregister')
  async deregister(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.seasonParticipantsService.deregisterCurrentSeasonParticipation(authUser.id);
  }
}
