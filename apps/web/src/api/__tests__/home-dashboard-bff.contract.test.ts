import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { homeApi, HomeDashboardFetchError } from '../home';

const HOME_API_SOURCE = resolve(process.cwd(), 'src/api/home.ts');
const HOME_DASHBOARD_ROUTE_SOURCE = resolve(process.cwd(), 'src/app/api/home/dashboard/route.ts');

function readHomeApiSource() {
  return readFileSync(HOME_API_SOURCE, 'utf8');
}

function stubDashboardFetch(json: unknown, status = 200, contentType = 'application/json') {
  const fetchMock = vi.fn(async () => {
    return new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': contentType },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('home dashboard BFF contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('homeApi keeps legacy widget methods while exposing the dashboard read-model method', () => {
    expect(homeApi).toHaveProperty('getBuildingStats');
    expect(homeApi).toHaveProperty('getPastSeasonResult');
    expect(homeApi).toHaveProperty('isNextSeasonRegistered');
    expect(homeApi).toHaveProperty('getDashboard');
    expect(typeof homeApi.getDashboard).toBe('function');
  });

  it('Web exposes a same-origin /api/home/dashboard route handler', () => {
    expect(existsSync(HOME_DASHBOARD_ROUTE_SOURCE)).toBe(true);
  });

  it('homeApi.getDashboard delegates to /api/home/dashboard with no-store and parses the shared contract', async () => {
    const dashboard = createHomeDashboardTestResponse();
    const fetchMock = stubDashboardFetch(dashboard);

    await expect(homeApi.getDashboard()).resolves.toEqual(dashboard);

    expect(fetchMock).toHaveBeenCalledWith('/api/home/dashboard', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  });

  it('homeApi.getDashboard does not convert upstream errors into zero/empty dashboard fallbacks', async () => {
    stubDashboardFetch({ success: false, code: 'UPSTREAM_ERROR' }, 500);

    await expect(homeApi.getDashboard()).rejects.toBeInstanceOf(HomeDashboardFetchError);
    await expect(homeApi.getDashboard()).rejects.toMatchObject({
      code: 'HOME_DASHBOARD_UPSTREAM_UNAVAILABLE',
    });
  });

  it('homeApi.getDashboard rejects schema drift instead of returning a partial dashboard', async () => {
    stubDashboardFetch({ season: { state: 'SEASON_OPEN' } });

    await expect(homeApi.getDashboard()).rejects.toMatchObject({
      code: 'HOME_DASHBOARD_UPSTREAM_INVALID',
    });
  });

  it('documents that legacy widget fallbacks remain isolated behind non-dashboard methods', () => {
    const source = readHomeApiSource();

    expect(source).toContain('/api/home/dashboard');
    expect(source).toContain('totalParticipants: 0');
    expect(source).toContain('?? true');
    expect(source).toContain('?? 0');
  });
});
