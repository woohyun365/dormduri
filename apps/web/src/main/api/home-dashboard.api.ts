import { homeDashboardResponseSchema, type HomeDashboardResponse } from '@repo/shared/home';

export class HomeDashboardFetchError extends Error {
  constructor(
    public readonly code: 'HOME_DASHBOARD_UPSTREAM_UNAVAILABLE' | 'HOME_DASHBOARD_UPSTREAM_INVALID',
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'HomeDashboardFetchError';
  }
}

async function readHomeDashboardJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new HomeDashboardFetchError(
      'HOME_DASHBOARD_UPSTREAM_INVALID',
      'Home dashboard response is not JSON.',
    );
  }

  try {
    return await response.json();
  } catch {
    throw new HomeDashboardFetchError(
      'HOME_DASHBOARD_UPSTREAM_INVALID',
      'Home dashboard response JSON is malformed.',
    );
  }
}

async function fetchHomeDashboard(signal?: AbortSignal): Promise<HomeDashboardResponse> {
  let response: Response;
  try {
    response = await fetch('/api/home/dashboard', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal,
    });
  } catch {
    throw new HomeDashboardFetchError(
      'HOME_DASHBOARD_UPSTREAM_UNAVAILABLE',
      'Home dashboard request failed.',
    );
  }

  if (!response.ok) {
    throw new HomeDashboardFetchError(
      'HOME_DASHBOARD_UPSTREAM_UNAVAILABLE',
      'Home dashboard upstream returned an error status.',
      response.status,
    );
  }

  const parsed = homeDashboardResponseSchema.safeParse(await readHomeDashboardJson(response));
  if (!parsed.success) {
    throw new HomeDashboardFetchError(
      'HOME_DASHBOARD_UPSTREAM_INVALID',
      'Home dashboard response did not match the public contract.',
    );
  }

  return parsed.data;
}

export const homeDashboardApi = {
  getDashboard: fetchHomeDashboard,
};
