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

function createFinalPassDashboardResponse(): unknown {
  const dashboard = createHomeDashboardTestResponse();

  return {
    ...dashboard,
    viewer: {
      ...dashboard.viewer,
      identity: {
        user: {
          id: 'user-1',
          email: 'home-e2e-viewer@kangwon.ac.kr',
          nickname: '홈유저',
          gender: 'F',
          campus: 'CHUNCHEON',
        },
        displayIdentity: {
          userId: 'user-1',
          nickname: '홈유저',
          nicknameSource: 'USER_DISPLAY_IDENTITY',
          nicknameChangedAt: null,
        },
        academicIdentity: {
          collegeCode: 'ARTS_ENGINEERING',
          birthYear: 2001,
        },
      },
    },
    seasonHistorySummary: {
      lastSeason: {
        id: 'season-2026-01',
        name: '2026년 1학기',
        totalParticipants: 237,
        totalMatchSuccess: 42,
        viewerHadRegistration: true,
        viewerHadMatchSuccess: false,
      },
    },
    nextSeasonPreview: {
      id: 'season-2026-02',
      name: '2026년 2학기',
      preparationStartDate: '2026-08-20',
      matchingStartDate: '2026-09-01',
      seasonEndDate: '2026-12-20',
      visibleToUser: true,
    },
  };
}

describe('home dashboard BFF contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('homeApi exposes only the dashboard read-model method', () => {
    expect(Object.keys(homeApi)).toEqual(['getDashboard']);
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

  it('accepts the final Home dashboard contract fields needed for auth to Home first render', async () => {
    const dashboard = createFinalPassDashboardResponse();
    stubDashboardFetch(dashboard);

    await expect(homeApi.getDashboard()).resolves.toMatchObject({
      viewer: {
        identity: {
          user: {
            id: 'user-1',
            nickname: '홈유저',
            campus: 'CHUNCHEON',
          },
          displayIdentity: {
            nickname: '홈유저',
          },
          academicIdentity: {
            collegeCode: 'ARTS_ENGINEERING',
            birthYear: 2001,
          },
        },
      },
      seasonHistorySummary: {
        lastSeason: {
          id: 'season-2026-01',
          totalParticipants: 237,
          totalMatchSuccess: 42,
        },
      },
      nextSeasonPreview: {
        id: 'season-2026-02',
        visibleToUser: true,
      },
    });
  });

  it('keeps the Home dashboard client free of legacy mock and widget fallbacks', () => {
    const source = readHomeApiSource();

    expect(source).toContain('/api/home/dashboard');
    expect(source).not.toMatch(
      /@\/__fixtures__|getMockData|mock-home-service|getBuildingStats|getPastSeasonResult|isNextSeasonRegistered|getUnreadMessages|getPastSeasons/,
    );
    expect(source).not.toContain('totalParticipants: 0');
  });
});
