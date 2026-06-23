import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../seasons/ports/season-context.port.js';
import { CurrentUserViewService } from '../../users/current-user/current-user-view.service.js';
import { HomeDashboardCountsQuery } from './home-dashboard-counts.query.js';
import { HomeDashboardPresenter } from './home-dashboard.presenter.js';

@Injectable()
export class HomeDashboardQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUserViewService: CurrentUserViewService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly countsQuery: HomeDashboardCountsQuery,
    private readonly presenter: HomeDashboardPresenter,
  ) {}

  async execute(authUser: AuthenticatedUserContext) {
    const now = await this.prisma.getDatabaseNow();
    const currentUser = await this.currentUserViewService.getCurrentUserAt(authUser, now);
    const seasonContext = currentUser.serviceState.campusOperated
      ? await this.seasonsService.getCurrentSeasonContext(authUser.campus, now)
      : null;
    const participant = await this.countsQuery.findCurrentParticipant(seasonContext, authUser.id);
    const [stats, matching, hasMatchHistory] = await Promise.all([
      this.countsQuery.getStats({ seasonContext, participant, now }),
      this.countsQuery.getMatching({ seasonContext, participant, now }),
      this.countsQuery.hasMatchHistory(authUser.id),
    ]);

    return this.presenter.build({
      currentUser,
      seasonContext,
      stats,
      matching: {
        ...matching,
        activeMatch: currentUser.match.activeMatch,
      },
      canViewMatchHistory: hasMatchHistory || currentUser.match.hasActiveMatch,
      generatedAt: now,
    });
  }
}
