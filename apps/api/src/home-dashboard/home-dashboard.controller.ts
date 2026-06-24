import { Controller, Get, Inject } from '@nestjs/common';
import { RequireCapability } from '../auth/access/auth-access.decorator.js';
import { AUTH_CAPABILITIES } from '../auth/access/auth-capability.js';
import { CurrentUser } from '../auth/access/authenticated-user.decorator.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import { HOME_DASHBOARD_QUERY, type HomeDashboardQueryPort } from './home-dashboard.tokens.js';

@Controller('api/home')
@RequireCapability()
export class HomeDashboardController {
  constructor(
    @Inject(HOME_DASHBOARD_QUERY) private readonly homeDashboardQuery: HomeDashboardQueryPort,
  ) {}

  @Get('dashboard')
  @RequireCapability(AUTH_CAPABILITIES.USER_READ_SELF)
  async getDashboard(@CurrentUser() authUser: AuthenticatedUserContext) {
    return this.homeDashboardQuery.execute(authUser);
  }
}
