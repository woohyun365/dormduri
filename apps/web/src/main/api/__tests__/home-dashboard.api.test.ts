import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHomeDashboardTestResponse } from '@/main/test-support/home-dashboard.builder';
import { homeDashboardApi, HomeDashboardFetchError } from '../home-dashboard.api';

const HOME_API_SOURCE = resolve(process.cwd(), 'src/main/api/home-dashboard.api.ts');
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
        viewerActivity: {
          sentRequestCount: 2,
          receivedRequestCount: 1,
          conversationCount: 0,
          finalResult: 'NO_MATCH',
          matchedPartnerNickname: null,
        },
        aggregate: {
          matchedPairCount: 21,
          operatedDormitoryCount: 5,
        },
      },
    },
    nextSeasonPreview: {
      id: 'season-2026-02',
      name: '2026년 2학기',
      preparationStartDate: '2026-07-23',
      matchingStartDate: '2026-08-01',
      seasonEndDate: '2026-08-31',
      visibleToUser: true,
      operatedDormitories: [
        { dormitoryId: 'daon', isOperated: true, roomSelectionDate: '2026-08-06' },
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-08-06' },
        { dormitoryId: 'irum', isOperated: true, roomSelectionDate: '2026-08-06' },
        { dormitoryId: 'saerom', isOperated: true, roomSelectionDate: '2026-08-06' },
        { dormitoryId: 'yeji', isOperated: true, roomSelectionDate: '2026-08-06' },
      ],
    },
  };
}

describe('home dashboard BFF contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('homeDashboardApi exposes only the dashboard read-model method', () => {
    expect(Object.keys(homeDashboardApi)).toEqual(['getDashboard']);
    expect(typeof homeDashboardApi.getDashboard).toBe('function');
  });

  it('Web exposes a same-origin /api/home/dashboard route handler', () => {
    expect(existsSync(HOME_DASHBOARD_ROUTE_SOURCE)).toBe(true);
  });

  it('homeDashboardApi.getDashboard delegates to /api/home/dashboard with no-store and parses the shared contract', async () => {
    const dashboard = createHomeDashboardTestResponse();
    const fetchMock = stubDashboardFetch(dashboard);

    await expect(homeDashboardApi.getDashboard()).resolves.toEqual(dashboard);

    expect(fetchMock).toHaveBeenCalledWith('/api/home/dashboard', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
  });

  it('homeDashboardApi.getDashboard does not convert upstream errors into zero/empty dashboard fallbacks', async () => {
    stubDashboardFetch({ success: false, code: 'UPSTREAM_ERROR' }, 500);

    await expect(homeDashboardApi.getDashboard()).rejects.toBeInstanceOf(HomeDashboardFetchError);
    await expect(homeDashboardApi.getDashboard()).rejects.toMatchObject({
      code: 'HOME_DASHBOARD_UPSTREAM_UNAVAILABLE',
    });
  });

  it('homeDashboardApi.getDashboard rejects schema drift instead of returning a partial dashboard', async () => {
    stubDashboardFetch({ season: { state: 'SEASON_OPEN' } });

    await expect(homeDashboardApi.getDashboard()).rejects.toMatchObject({
      code: 'HOME_DASHBOARD_UPSTREAM_INVALID',
    });
  });

  it('accepts the final Home dashboard contract fields needed for auth to Home first render', async () => {
    const dashboard = createFinalPassDashboardResponse();
    stubDashboardFetch(dashboard);

    await expect(homeDashboardApi.getDashboard()).resolves.toMatchObject({
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
          viewerActivity: {
            sentRequestCount: 2,
            receivedRequestCount: 1,
            conversationCount: 0,
            finalResult: 'NO_MATCH',
            matchedPartnerNickname: null,
          },
          aggregate: {
            matchedPairCount: 21,
            operatedDormitoryCount: 5,
          },
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
