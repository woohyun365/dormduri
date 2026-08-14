import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createRoommateBlock,
  createRoommateBookmark,
  createRoommateMatchRequest,
  createRoommateReport,
  deleteRoommateBookmark,
  getRoommateBookmarkList,
} from '../roommateActions.client';

function stubFetch(body: unknown, init: ResponseInit = {}) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: init.status ?? 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const serverTime = '2026-06-08T00:00:00.000Z';

function createMatchRequestActionResponse() {
  return {
    request: {
      id: 'request-1',
      seasonId: 'season-1',
      direction: 'SENT',
      counterpartUserId: 'target-1',
      counterpartParticipantId: 'participant-target-1',
      counterpartSummary: {
        id: 'target-1',
        sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
        relation: { type: 'GENERAL' },
        exposure: {
          listSummaryVisible: true,
          detailViewable: true,
          canViewFull: true,
          scoreVisible: true,
        },
        actions: {
          canBookmark: true,
          canRequestMatch: true,
          canStartChat: false,
          unavailableReasons: [],
        },
        resultRead: { resultReadable: false, context: 'NONE' },
        profileSummary: {
          nickname: '테스트 룸메이트',
          intro: '조용한 생활을 선호해요.',
          smokingBehavior: 'NO',
          sleepHabit: 'NONE',
          relationshipStyle: 'CASUAL',
        },
        bookmark: { bookmarked: false },
        detailEntryToken: 'detail-token-1',
        matchScore: 88,
      },
      status: 'PENDING',
      note: '잘 부탁해요.',
      createdAt: serverTime,
      expiresAt: '2026-06-13T00:00:00.000Z',
      terminalAt: null,
      acceptedAt: null,
      terminalReason: null,
    },
    activeMatch: null,
  };
}

describe('roommateActions.client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bookmark list는 query를 /api/bookmarks로 보내고 shared schema로 parse한다', async () => {
    const fetchMock = stubFetch({
      items: [],
      pageInfo: { hasNextPage: false, nextCursor: null },
      emptyState: { code: 'NO_BOOKMARKS' },
      sort: 'MATCH_SCORE',
      serverTime,
    });

    const response = await getRoommateBookmarkList({
      sort: 'MATCH_SCORE',
      cursor: 'c1',
      limit: 10,
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/bookmarks?sort=MATCH_SCORE&cursor=c1&limit=10', {
      cache: 'no-store',
      method: 'GET',
      signal: undefined,
    });
    expect(response.emptyState?.code).toBe('NO_BOOKMARKS');
  });

  it('bookmark create/delete는 targetUserId path segment를 encode하고 body를 보내지 않는다', async () => {
    const createFetch = stubFetch({
      bookmark: {
        id: 'bookmark-1',
        targetUserId: 'user 1/2',
        targetParticipantId: 'participant-1',
        bookmarkedAt: serverTime,
      },
      created: true,
      listMetadata: { sort: 'RECENT', serverTime },
    });

    await createRoommateBookmark('user 1/2');

    expect(createFetch).toHaveBeenCalledWith('/api/bookmarks/user%201%2F2', {
      cache: 'no-store',
      method: 'POST',
      signal: undefined,
    });

    vi.unstubAllGlobals();
    const deleteFetch = stubFetch({
      deleted: true,
      listMetadata: { sort: 'RECENT', serverTime },
    });

    await deleteRoommateBookmark('user 1/2');

    expect(deleteFetch).toHaveBeenCalledWith('/api/bookmarks/user%201%2F2', {
      cache: 'no-store',
      method: 'DELETE',
      signal: undefined,
    });
  });

  it('block/report/match request action은 JSON body와 shared schema를 사용한다', async () => {
    const blockFetch = stubFetch({
      block: {
        id: 'block-1',
        blockedUserId: 'user 1/2',
        blockedAt: serverTime,
        note: '다시 매칭하고 싶지 않음',
      },
      created: true,
      listMetadata: { serverTime },
    });

    await createRoommateBlock('user 1/2', { note: '다시 매칭하고 싶지 않음' });

    expect(blockFetch).toHaveBeenCalledWith('/api/blocks/user%201%2F2', {
      cache: 'no-store',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: '다시 매칭하고 싶지 않음' }),
      signal: undefined,
    });

    vi.unstubAllGlobals();
    const reportFetch = stubFetch({
      report: {
        id: 'report-1',
        targetType: 'PROFILE',
        reason: 'FALSE_PROFILE',
        receivedAt: serverTime,
        status: 'RECEIVED',
      },
      received: true,
      optionalActionResult: { action: 'BLOCK_TARGET', status: 'SUCCEEDED' },
    });

    const report = await createRoommateReport({
      targetType: 'PROFILE',
      targetId: 'target-1',
      reason: 'FALSE_PROFILE',
      detail: null,
      evidenceAttachmentIds: [],
      optionalAction: 'BLOCK_TARGET',
      falseReportDisclaimerAccepted: true,
    });

    expect(report.report.id).toBe('report-1');
    expect(reportFetch).toHaveBeenCalledWith(
      '/api/reports',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    vi.unstubAllGlobals();
    const matchFetch = stubFetch(createMatchRequestActionResponse());

    const matchRequest = await createRoommateMatchRequest({
      targetUserId: 'target-1',
      note: '잘 부탁해요.',
    });

    expect(matchRequest.request.status).toBe('PENDING');
    expect(matchFetch).toHaveBeenCalledWith(
      '/api/matches/requests',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: 'target-1', note: '잘 부탁해요.' }),
      }),
    );
  });

  it('domain error response는 safe RoommateApiError code로 normalize한다', async () => {
    stubFetch({ code: 'MATCH_REQUEST_NOT_ALLOWED' }, { status: 409 });

    await expect(
      createRoommateMatchRequest({ targetUserId: 'target-1', note: null }),
    ).rejects.toMatchObject({
      code: 'MATCH_REQUEST_NOT_ALLOWED',
      retryable: false,
    });
  });

  it('schema invalid response는 safe RoommateApiError로 닫는다', async () => {
    stubFetch({ items: [{ invalid: true }] });

    await expect(getRoommateBookmarkList()).rejects.toMatchObject({
      code: 'ROOMMATE_ACTION_SCHEMA_INVALID',
      retryable: true,
    });
  });
});
