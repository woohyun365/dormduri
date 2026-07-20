import { describe, expect, it } from 'vitest';
import {
  activeMatchActionResponseSchema,
  matchOverviewResponseSchema,
} from '@repo/shared/match/contract';

const validOverview = {
  serverNow: '2026-02-10T03:00:00.000Z',
  season: {
    id: 'season-1',
    state: 'SEASON_MATCHING',
    roomSelectionDate: '2026-02-11',
  },
  capability: {
    canViewMatching: true,
    reason: null,
  },
  sentRequests: [],
  receivedRequests: [],
  activeMatch: null,
  activity: [
    {
      id: 'request:request-1',
      counterpartParticipantId: 'participant-2',
      counterpartNickname: '감자친구',
      stage: 'SENT_REQUEST',
      result: 'REQUEST_REJECTED',
      direction: 'SENT',
      occurredAt: '2026-02-10T03:00:00.000Z',
      requestTerminalReason: 'REJECTED_BY_RECEIVER',
      systemCancellationCause: null,
      systemCancellationGroupId: null,
      activeMatchEndReason: null,
    },
  ],
};

const activeMatch = {
  id: 'active-1',
  seasonId: 'season-1',
  counterpartUserId: 'user-2',
  counterpartParticipantId: 'participant-2',
  counterpartNickname: '감자친구',
  status: 'ACTIVE',
  startedAt: '2026-02-10T03:00:00.000Z',
  endedAt: null,
  endReason: null,
  createdFromRequestId: 'request-1',
  unmatchProgress: {
    state: 'NONE',
    requestedByViewerAt: null,
    requestedByCounterpartAt: null,
    progressCount: 0,
    requiredCount: 2,
    canRequest: true,
    canCancel: false,
    disabledReason: null,
    availableUntil: '2026-02-12T14:59:59.999Z',
  },
} as const;

describe('match overview shared contract', () => {
  it('public current snapshot의 최소 shape를 parse한다', () => {
    expect(matchOverviewResponseSchema.parse(validOverview)).toEqual(validOverview);
  });

  it('unknown capability reason과 raw extra field를 fail-closed 처리한다', () => {
    expect(
      matchOverviewResponseSchema.safeParse({
        ...validOverview,
        capability: { canViewMatching: false, reason: 'INTERNAL_MODERATION_CASE' },
      }).success,
    ).toBe(false);
    expect(matchOverviewResponseSchema.safeParse({ ...validOverview, audit: {} }).success).toBe(
      false,
    );
  });

  it('request action은 accept/reject/cancel별 decision과 reason을 독립적으로 검증한다', () => {
    const request = {
      id: 'request-1',
      seasonId: 'season-1',
      direction: 'RECEIVED',
      counterpartUserId: 'user-2',
      counterpartParticipantId: 'participant-2',
      counterpartSummary: {
        id: 'user-2',
        sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
        relation: { type: 'GENERAL' },
        exposure: {
          listSummaryVisible: true,
          canViewFull: false,
          detailViewable: false,
          scoreVisible: false,
        },
        actions: {
          canBookmark: false,
          canRequestMatch: false,
          canStartChat: false,
          unavailableReasons: ['TARGET_NOT_PUBLIC'],
        },
        resultRead: { resultReadable: false, context: 'NONE' },
        profileSummary: {
          nickname: '감자친구',
          intro: '',
          smokingBehavior: null,
          sleepHabit: null,
          relationshipStyle: null,
        },
      },
      status: 'PENDING',
      note: null,
      createdAt: '2026-02-10T03:00:00.000Z',
      expiresAt: '2026-02-11T03:00:00.000Z',
      terminalAt: null,
      acceptedAt: null,
      terminalReason: null,
      actions: {
        accept: { allowed: false, reason: 'MATCH_PRECONDITION_FAILED' },
        reject: { allowed: true, reason: null },
        cancel: { allowed: false, reason: null },
      },
    } as const;

    expect(
      matchOverviewResponseSchema.safeParse({ ...validOverview, receivedRequests: [request] })
        .success,
    ).toBe(true);
    expect(
      matchOverviewResponseSchema.safeParse({
        ...validOverview,
        receivedRequests: [
          {
            ...request,
            actions: {
              accept: { allowed: false, reason: 'INTERNAL_PRECONDITION' },
              reject: { allowed: true, reason: null },
              cancel: { allowed: false, reason: null },
            },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('current overview active relation은 ACTIVE와 null end fields만 허용한다', () => {
    expect(matchOverviewResponseSchema.safeParse({ ...validOverview, activeMatch }).success).toBe(
      true,
    );
    expect(
      matchOverviewResponseSchema.safeParse({
        ...validOverview,
        activeMatch: {
          ...activeMatch,
          status: 'UNMATCHED',
          endedAt: '2026-02-10T04:00:00.000Z',
          endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
        },
      }).success,
    ).toBe(false);
  });

  it('current activity는 archive와 같은 public result와 causal field만 허용한다', () => {
    expect(matchOverviewResponseSchema.safeParse(validOverview).success).toBe(true);
    expect(
      matchOverviewResponseSchema.safeParse({
        ...validOverview,
        activity: [{ ...validOverview.activity[0], systemCancellationCause: 'INTERNAL_RACE' }],
      }).success,
    ).toBe(false);
  });

  it('terminal unmatch action response는 COMPLETED 2/2를 계속 허용한다', () => {
    expect(
      activeMatchActionResponseSchema.safeParse({
        activeMatch: {
          ...activeMatch,
          status: 'UNMATCHED',
          endedAt: '2026-02-10T04:00:00.000Z',
          endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
          unmatchProgress: {
            ...activeMatch.unmatchProgress,
            state: 'COMPLETED',
            progressCount: 2,
            canRequest: false,
            disabledReason: 'ACTIVE_MATCH_NOT_ACTIONABLE',
          },
        },
      }).success,
    ).toBe(true);
  });

  it('unmatch disabled reason은 public enum만 허용한다', () => {
    expect(
      matchOverviewResponseSchema.safeParse({
        ...validOverview,
        activeMatch: {
          ...activeMatch,
          unmatchProgress: {
            ...activeMatch.unmatchProgress,
            canRequest: false,
            disabledReason: 'INTERNAL_POLICY_REASON',
          },
        },
      }).success,
    ).toBe(false);
  });
});
