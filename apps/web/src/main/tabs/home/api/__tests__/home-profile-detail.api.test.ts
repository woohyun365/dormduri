import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPreviousSeasonProfileResponse,
  createPublicProfileFull,
  createPublicProfileTombstone,
  createSeasonProfileDraftResponse,
} from '@/test/home-profile-detail-fixtures';
import { homeProfileDetailApi, HomeProfileDetailFetchError } from '../home-profile-detail.api';

function stubHomeProfileDetailFetch(json: unknown, status = 200) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('homeProfileDetailApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('current season profile을 BFF route에서 읽고 contract로 검증한다', async () => {
    const fetchMock = stubHomeProfileDetailFetch(createSeasonProfileDraftResponse());

    await expect(homeProfileDetailApi.getCurrentSeasonProfile()).resolves.toMatchObject({
      state: 'REGISTRATION_FINALIZED',
      additional: { mbti: 'INTJ' },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/seasons/current/profile',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });

  it('previous season profile을 BFF route에서 읽고 contract로 검증한다', async () => {
    const fetchMock = stubHomeProfileDetailFetch(createPreviousSeasonProfileResponse());

    await expect(homeProfileDetailApi.getPreviousSeasonProfile()).resolves.toMatchObject({
      detailState: 'FULL',
      seasonName: '2026년 1학기',
      dormitoryName: '다산관',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/seasons/previous/profile',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });

  it('public profile user id를 encode하고 FULL/TOMBSTONE contract를 처리한다', async () => {
    const fullFetchMock = stubHomeProfileDetailFetch(createPublicProfileFull());

    await expect(homeProfileDetailApi.getPublicProfileByUserId('user 1/2')).resolves.toMatchObject({
      detailState: 'FULL',
      nickname: '감자친구',
    });
    expect(fullFetchMock).toHaveBeenCalledWith(
      '/api/profiles/user%201%2F2',
      expect.objectContaining({ method: 'GET' }),
    );

    vi.unstubAllGlobals();
    stubHomeProfileDetailFetch(createPublicProfileTombstone());
    await expect(homeProfileDetailApi.getPublicProfileByUserId('removed')).resolves.toMatchObject({
      detailState: 'TOMBSTONE',
    });
  });

  it('schema mismatch는 typed error로 반환한다', async () => {
    stubHomeProfileDetailFetch({ malformed: true });

    await expect(homeProfileDetailApi.getCurrentSeasonProfile()).rejects.toBeInstanceOf(
      HomeProfileDetailFetchError,
    );
  });
});
