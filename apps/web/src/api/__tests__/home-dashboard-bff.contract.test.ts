import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homeApi } from '../home';

const HOME_API_SOURCE = resolve(process.cwd(), 'src/api/home.ts');
const HOME_DASHBOARD_ROUTE_SOURCE = resolve(process.cwd(), 'src/app/api/home/dashboard/route.ts');

function readHomeApiSource() {
  return readFileSync(HOME_API_SOURCE, 'utf8');
}

describe('home dashboard BFF contract baseline', () => {
  it('documents that homeApi still exposes legacy widget methods only', () => {
    expect(homeApi).toHaveProperty('getBuildingStats');
    expect(homeApi).toHaveProperty('getPastSeasonResult');
    expect(homeApi).toHaveProperty('isNextSeasonRegistered');
    expect(homeApi).not.toHaveProperty('getDashboard');
    expect(homeApi).not.toHaveProperty('getHomeDashboard');
  });

  it('documents that production homeApi still has silent zero/empty fallbacks', () => {
    const source = readHomeApiSource();

    expect(source).toContain('totalParticipants: 0');
    expect(source).toContain('assignedParticipants: 0');
    expect(source).toContain('?? true');
    expect(source).toContain('?? 0');
  });

  it('documents that the same-origin home dashboard BFF route is not implemented yet', () => {
    expect(existsSync(HOME_DASHBOARD_ROUTE_SOURCE)).toBe(false);
  });

  it.skip('target: homeApi exposes a single home dashboard read-model method', () => {
    expect(typeof (homeApi as { getDashboard?: unknown }).getDashboard).toBe('function');
  });

  it.skip('target: homeApi production path delegates to /api/home/dashboard without silent zeros', () => {
    const source = readHomeApiSource();

    expect(source).toContain('/api/home/dashboard');
    expect(source).not.toContain('totalParticipants: 0');
    expect(source).not.toContain('?? true');
    expect(source).not.toContain('?? 0');
  });

  it.skip('target: Web exposes a same-origin /api/home/dashboard route handler', () => {
    expect(existsSync(HOME_DASHBOARD_ROUTE_SOURCE)).toBe(true);
  });
});
