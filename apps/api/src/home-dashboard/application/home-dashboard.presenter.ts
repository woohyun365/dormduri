import { Injectable } from '@nestjs/common';
import {
  homeDashboardResponseSchema,
  type HomeDashboardMatching,
  type HomeDashboardNextSeasonPreview,
  type HomeDashboardResponse,
  type HomeDashboardSeasonHistorySummary,
  type HomeDashboardStats,
} from '@repo/shared/home';
import type { CurrentUserResponse } from '@repo/shared/user';
import type { CurrentSeasonContext } from '../../seasons/ports/season-context.port.js';

interface BuildHomeDashboardResponseInput {
  currentUser: CurrentUserResponse;
  seasonContext: CurrentSeasonContext | null;
  stats: HomeDashboardStats;
  matching: HomeDashboardMatching;
  seasonHistorySummary: HomeDashboardSeasonHistorySummary;
  nextSeasonPreview: HomeDashboardNextSeasonPreview;
  canViewMatchHistory: boolean;
  generatedAt: Date;
}

@Injectable()
export class HomeDashboardPresenter {
  build(input: BuildHomeDashboardResponseInput): HomeDashboardResponse {
    const seasonContext = input.seasonContext;
    const response: HomeDashboardResponse = {
      season: seasonContext
        ? {
            hasCurrentSeason: true,
            state: seasonContext.state,
            summary: seasonContext.season,
            schedule: seasonContext.schedule,
            isOpen: seasonContext.isOpen,
            isMatching: seasonContext.isMatching,
            isPostMatch: seasonContext.isPostMatch,
            daysUntilMatchingEnd: seasonContext.daysUntilMatchingEnd,
            daysUntilSeasonEnd: seasonContext.daysUntilSeasonEnd,
            operatedDormitories: seasonContext.operatedDormitories,
          }
        : {
            hasCurrentSeason: false,
            state: input.currentUser.serviceState.campusOperated
              ? input.currentUser.serviceState.seasonState
              : null,
            summary: null,
            schedule: null,
            isOpen: false,
            isMatching: false,
            isPostMatch: false,
            daysUntilMatchingEnd: null,
            daysUntilSeasonEnd: null,
            operatedDormitories: [],
          },
      viewer: {
        campusOperated: input.currentUser.serviceState.campusOperated,
        identity: {
          user: input.currentUser.user,
          displayIdentity: input.currentUser.displayIdentity,
          academicIdentity: input.currentUser.academicIdentity,
        },
        seasonProfile: input.currentUser.seasonProfile,
        selection: input.currentUser.selection,
        match: input.currentUser.match,
        capabilities: {
          canEnterRoommateSearch: input.currentUser.capabilities.canEnterRoommateSearch,
          canCreateOrUpdateSeasonProfileDraft:
            input.currentUser.capabilities.canCreateOrUpdateSeasonProfileDraft,
          canSelectDormitory: input.currentUser.capabilities.canSelectDormitory,
          canFinalizeSeasonRegistration:
            input.currentUser.capabilities.canFinalizeSeasonRegistration,
          canRequestMatch: input.currentUser.capabilities.canRequestMatch,
          canStartChat: input.currentUser.capabilities.canStartChat,
          canViewMatchHistory: input.canViewMatchHistory,
        },
        onboarding: input.currentUser.onboarding,
      },
      stats: input.stats,
      matching: input.matching,
      seasonHistorySummary: input.seasonHistorySummary,
      nextSeasonPreview: input.nextSeasonPreview,
      generatedAt: input.generatedAt.toISOString(),
    };

    return homeDashboardResponseSchema.parse(response);
  }
}
