import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { CurrentUserViewModule } from '../users/current-user/current-user-view.module.js';
import { HomeDashboardCountsQuery } from './application/home-dashboard-counts.query.js';
import { HomeDashboardHistoryQuery } from './application/home-dashboard-history.query.js';
import { HomeDashboardNextSeasonQuery } from './application/home-dashboard-next-season.query.js';
import { HomeDashboardPresenter } from './application/home-dashboard.presenter.js';
import { HomeDashboardQuery } from './application/home-dashboard.query.js';
import { HomeDashboardController } from './home-dashboard.controller.js';
import { HOME_DASHBOARD_QUERY } from './home-dashboard.tokens.js';

@Module({
  imports: [PrismaModule, SeasonsModule, CurrentUserViewModule],
  controllers: [HomeDashboardController],
  providers: [
    HomeDashboardQuery,
    HomeDashboardCountsQuery,
    HomeDashboardHistoryQuery,
    HomeDashboardNextSeasonQuery,
    HomeDashboardPresenter,
    { provide: HOME_DASHBOARD_QUERY, useExisting: HomeDashboardQuery },
  ],
})
export class HomeDashboardModule {}
