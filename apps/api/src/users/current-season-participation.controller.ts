import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import {
  selectedDormitorySubmitRequestSchema,
  seasonRegistrationFinalizeRequestSchema,
  updateSeasonProfileRequestSchema,
} from '@repo/shared/season-contract';
import { AuthenticatedUser } from '../auth/authenticated-user.decorator.js';
import { AuthenticatedUserGuard } from '../auth/authenticated-user.guard.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { parseRequestBody } from '../common/http/zod-request.js';
import { SeasonParticipantsService } from '../season-participants/season-participants.service.js';

@Controller('api/seasons/current/profile')
@UseGuards(AuthenticatedUserGuard)
export class CurrentSeasonProfileController {
  constructor(private readonly seasonParticipantsService: SeasonParticipantsService) {}

  @Get()
  async getCurrentSeasonProfile(@AuthenticatedUser() authUser: AuthenticatedUserContext) {
    return this.seasonParticipantsService.getCurrentSeasonProfile(authUser.id);
  }

  @Put()
  async createOrUpdateSeasonProfileDraft(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    const parsed = parseRequestBody(updateSeasonProfileRequestSchema, body);
    return this.seasonParticipantsService.createOrUpdateSeasonProfileDraft(authUser.id, parsed);
  }
}

@Controller('api/seasons/current/participation')
@UseGuards(AuthenticatedUserGuard)
export class CurrentSeasonParticipationController {
  constructor(private readonly seasonParticipantsService: SeasonParticipantsService) {}

  @Get('selectable-dormitories')
  async listSelectableDormitories(@AuthenticatedUser() authUser: AuthenticatedUserContext) {
    return this.seasonParticipantsService.listSelectableDormitoriesForCurrentSeason(authUser.id);
  }

  @Post('dormitory-selection')
  async createOrUpdateDormitorySelection(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    const parsed = parseRequestBody(selectedDormitorySubmitRequestSchema, body);
    return this.seasonParticipantsService.createOrUpdateDormitorySelection(authUser.id, parsed);
  }

  @Post('registration')
  async finalizeSeasonRegistration(
    @AuthenticatedUser() authUser: AuthenticatedUserContext,
    @Body() body: unknown,
  ) {
    parseRequestBody(seasonRegistrationFinalizeRequestSchema, body ?? {});
    return this.seasonParticipantsService.finalizeSeasonRegistration(authUser.id);
  }

  @Post('deregister')
  async deregister(@AuthenticatedUser() authUser: AuthenticatedUserContext) {
    return this.seasonParticipantsService.deregisterCurrentSeasonParticipation(authUser.id);
  }
}
