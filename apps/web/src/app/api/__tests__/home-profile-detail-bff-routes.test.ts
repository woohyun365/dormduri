import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createBffRequest as createRequest,
  firstFetchInit,
  firstFetchInput,
  stubJsonFetch,
} from '../../../test/bff-route';
import {
  createMatchHistoryResponse,
  createPreviousSeasonProfileResponse,
  createPublicProfileFull,
  createPublicProfileTombstone,
  createSeasonProfileDraftResponse,
} from '../../../test/home-profile-detail-fixtures';
import { GET as getMatchHistory } from '../matches/history/route';
import { GET as getMatchHistoryCounterpartProfile } from '../matches/history/entries/[entryId]/counterpart-profile/route';
import { GET as getPublicProfile } from '../profiles/[userId]/route';
import { GET as getCurrentSeasonProfile } from '../seasons/current/profile/route';
import { GET as getPreviousSeasonProfile } from '../seasons/previous/profile/route';

const AUTH_TOKEN = `v1.session-home-profile.${'a'.repeat(43)}`;

describe('home profile detail BFF routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('current season profile route는 protected forwarding과 strict schema parsing을 수행한다', async () => {
    const fetchMock = stubJsonFetch(createSeasonProfileDraftResponse());
    const request = createRequest('/api/seasons/current/profile', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    const response = await getCurrentSeasonProfile(request);

    expect(firstFetchInput(fetchMock)).toBe('http://localhost:4000/api/seasons/current/profile');
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      state: 'REGISTRATION_FINALIZED',
      additional: { grade: '2' },
    });
  });

  it('previous season profile route는 직전 시즌 내 프로필 contract만 client에 전달한다', async () => {
    const fetchMock = stubJsonFetch(createPreviousSeasonProfileResponse());
    const request = createRequest('/api/seasons/previous/profile', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    const response = await getPreviousSeasonProfile(request);

    expect(firstFetchInput(fetchMock)).toBe('http://localhost:4000/api/seasons/previous/profile');
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      detailState: 'FULL',
      seasonName: '2026년 1학기',
      dormitoryName: '다산관',
    });
  });

  it('current season profile route는 upstream schema drift를 fail closed 처리한다', async () => {
    stubJsonFetch({ participantId: 'participant-1' });
    const request = createRequest('/api/seasons/current/profile', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    const response = await getCurrentSeasonProfile(request);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_INVALID',
    });
  });

  it('match history route는 history contract만 client에 전달한다', async () => {
    const fetchMock = stubJsonFetch(createMatchHistoryResponse());
    const request = createRequest('/api/matches/history', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    const response = await getMatchHistory(request);

    expect(firstFetchInput(fetchMock)).toBe('http://localhost:4000/api/matches/history');
    await expect(response.json()).resolves.toMatchObject({
      items: [{ seasonName: '2026년 1학기', history: [{ id: 'history-entry-1' }] }],
    });
  });

  it('history counterpart route는 entry path를 encode하고 FULL/TOMBSTONE profile contract를 처리한다', async () => {
    const fullFetchMock = stubJsonFetch(createPublicProfileFull());
    const fullRequest = createRequest(
      '/api/matches/history/entries/history%201%2F2/counterpart-profile',
      { headers: { Cookie: `auth-token=${AUTH_TOKEN}` } },
    );

    const fullResponse = await getMatchHistoryCounterpartProfile(fullRequest, {
      params: { entryId: 'history 1/2' },
    });

    expect(firstFetchInput(fullFetchMock)).toBe(
      'http://localhost:4000/api/matches/history/entries/history%201%2F2/counterpart-profile',
    );
    await expect(fullResponse.json()).resolves.toMatchObject({
      detailState: 'FULL',
      nickname: '감자친구',
    });

    vi.unstubAllGlobals();
    const tombstoneFetchMock = stubJsonFetch(createPublicProfileTombstone());
    const tombstoneRequest = createRequest(
      '/api/matches/history/entries/history-removed/counterpart-profile',
      { headers: { Cookie: `auth-token=${AUTH_TOKEN}` } },
    );

    const tombstoneResponse = await getMatchHistoryCounterpartProfile(tombstoneRequest, {
      params: { entryId: 'history-removed' },
    });

    expect(firstFetchInput(tombstoneFetchMock)).toBe(
      'http://localhost:4000/api/matches/history/entries/history-removed/counterpart-profile',
    );
    await expect(tombstoneResponse.json()).resolves.toMatchObject({
      detailState: 'TOMBSTONE',
      tombstone: { displayName: '상대 프로필' },
    });
  });

  it('public profile route는 user path와 detail query를 안전하게 upstream에 전달한다', async () => {
    const fetchMock = stubJsonFetch(createPublicProfileFull());
    const request = createRequest('/api/profiles/user%201%2F2?detailEntryToken=token-1', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    const response = await getPublicProfile(request, { params: { userId: 'user 1/2' } });

    expect(firstFetchInput(fetchMock)).toBe(
      'http://localhost:4000/api/profiles/user%201%2F2?detailEntryToken=token-1',
    );
    expect(firstFetchInit(fetchMock)).toEqual(
      expect.objectContaining({
        method: 'GET',
        cache: 'no-store',
        headers: expect.objectContaining({ Authorization: `Bearer ${AUTH_TOKEN}` }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      detailState: 'FULL',
      compatibility: {
        overallScore: 92,
        hiddenAxisNotices: [{ code: 'DRINKING_EXCLUDED_BY_POLICY' }],
      },
    });
  });

  it('public profile route는 compatibility hidden/raw field drift를 fail closed 처리한다', async () => {
    stubJsonFetch({
      ...createPublicProfileFull(),
      compatibility: {
        overallScore: 92,
        axes: [
          {
            id: 'SMOKING',
            score: 100,
            bucket: 'HIGH',
            targetCondition: 'NO_ONLY',
          },
        ],
        hiddenAxisNotices: [{ code: 'DRINKING_EXCLUDED_BY_POLICY' }],
      },
    });
    const request = createRequest('/api/profiles/user-2?detailEntryToken=token-1', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    const response = await getPublicProfile(request, { params: { userId: 'user-2' } });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_INVALID',
    });
  });

  it('public profile route는 scoreVisible=false compatibility drift를 fail closed 처리한다', async () => {
    stubJsonFetch({
      ...createPublicProfileFull(),
      exposure: {
        ...createPublicProfileFull().exposure,
        scoreVisible: false,
      },
    });
    const request = createRequest('/api/profiles/user-2?detailEntryToken=token-1', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    const response = await getPublicProfile(request, { params: { userId: 'user-2' } });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_INVALID',
    });
  });

  it('public profile route는 tombstone compatibility drift를 fail closed 처리한다', async () => {
    stubJsonFetch({
      ...createPublicProfileTombstone(),
      compatibility: {
        overallScore: 92,
        axes: [{ id: 'SMOKING', score: 100, bucket: 'HIGH' }],
        hiddenAxisNotices: [{ code: 'DRINKING_EXCLUDED_BY_POLICY' }],
      },
    });
    const request = createRequest('/api/profiles/user-removed?detailEntryToken=token-1', {
      headers: { Cookie: `auth-token=${AUTH_TOKEN}` },
    });

    const response = await getPublicProfile(request, { params: { userId: 'user-removed' } });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'BFF_UPSTREAM_SCHEMA_INVALID',
    });
  });
});
