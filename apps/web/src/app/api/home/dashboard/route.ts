import { homeDashboardResponseSchema } from '@repo/shared/home';
import type { NextRequest } from 'next/server';
import { forwardValidatedBffRequest } from '@/app/api/_bff/forward';

const UPSTREAM_HOME_DASHBOARD_PATH = '/api/home/dashboard';

export async function GET(request: NextRequest) {
  return forwardValidatedBffRequest({
    request,
    method: 'GET',
    path: UPSTREAM_HOME_DASHBOARD_PATH,
    operation: 'home.dashboard',
    authenticated: true,
    responseSchema: homeDashboardResponseSchema,
  });
}
