import type { HomeDashboardResponse } from '@repo/shared/home';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';

export interface HomeDashboardQueryPort {
  execute(authUser: AuthenticatedUserContext): Promise<HomeDashboardResponse>;
}

export const HOME_DASHBOARD_QUERY = Symbol('HOME_DASHBOARD_QUERY');
