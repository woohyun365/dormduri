import { describe, expect, it } from 'vitest';
import type { CurrentActiveMatchSummary } from '@repo/shared/match/contract';
import { toMatchingActiveView } from '../matching-active-view';

function activeMatch(
  overrides: Partial<CurrentActiveMatchSummary> = {},
): CurrentActiveMatchSummary {
  return {
    id: 'active-1',
    seasonId: 'season-1',
    counterpartUserId: 'user-2',
    counterpartParticipantId: 'participant-2',
    counterpartNickname: '도윤',
    counterpartSummary: {
      id: 'user-2',
      sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
      relation: { type: 'MATCHED_PARTNER' },
      exposure: {
        listSummaryVisible: true,
        detailViewable: true,
        canViewFull: true,
        scoreVisible: true,
      },
      actions: {
        canBookmark: false,
        canRequestMatch: false,
        canStartChat: true,
        unavailableReasons: ['VIEWER_ALREADY_MATCHED'],
      },
      resultRead: { resultReadable: true, context: 'CURRENT_MATCHED_PARTNER' },
      profileSummary: {
        nickname: '도윤',
        intro: '조용한 생활을 좋아해요.',
        smokingBehavior: 'NO',
        sleepHabit: null,
        relationshipStyle: null,
      },
      matchScore: 91,
    },
    status: 'ACTIVE',
    startedAt: '2026-08-01T00:00:00.000Z',
    endedAt: null,
    endReason: null,
    createdFromRequestId: 'request-1',
    matchScore: 91,
    unmatchProgress: {
      state: 'NONE',
      requestedByViewerAt: null,
      requestedByCounterpartAt: null,
      progressCount: 0,
      requiredCount: 2,
      canRequest: true,
      canCancel: false,
      disabledReason: null,
      availableUntil: '2026-08-10T14:59:59.999Z',
    },
    ...overrides,
  };
}

describe('toMatchingActiveView', () => {
  it('server projection만으로 summary, score, profile/chat capability를 만든다', () => {
    expect(toMatchingActiveView(activeMatch())).toMatchObject({
      id: 'active-1',
      nickname: '도윤',
      intro: '조용한 생활을 좋아해요.',
      score: 91,
      scoreState: 'visible',
      canOpenProfile: true,
      canStartChat: true,
      unmatch: {
        state: 'NONE',
        progressText: '0/2',
        statusCopy: '아직 매칭 해제에 동의한 사람이 없어요.',
        primaryAction: 'request',
      },
    });
  });

  it.each([
    ['WAITING_FOR_COUNTERPART', '1/2', 'counterpart', 'cancel'],
    ['WAITING_FOR_ME', '1/2', 'viewer', 'request'],
    ['COMPLETED', '2/2', 'completed', null],
  ] as const)(
    '%s progress를 exhaustive presentation으로 변환한다',
    (state, progressText, owner, action) => {
      const view = toMatchingActiveView(
        activeMatch({
          unmatchProgress: {
            ...activeMatch().unmatchProgress,
            state,
            progressCount: state === 'COMPLETED' ? 2 : 1,
            canRequest: state === 'WAITING_FOR_ME',
            canCancel: state === 'WAITING_FOR_COUNTERPART',
            disabledReason: state === 'COMPLETED' ? 'ACTIVE_MATCH_NOT_ACTIONABLE' : null,
          },
        }),
      );

      expect(view.unmatch).toMatchObject({
        progressText,
        consentOwner: owner,
        primaryAction: action,
      });
    },
  );

  it('partial/inconsistent summary는 score, detail, chat을 fail-closed한다', () => {
    const base = activeMatch();
    const view = toMatchingActiveView({
      ...base,
      counterpartSummary: {
        ...base.counterpartSummary!,
        exposure: { ...base.counterpartSummary!.exposure, scoreVisible: false },
        actions: { ...base.counterpartSummary!.actions, canStartChat: false },
        resultRead: { resultReadable: false, context: 'NONE' },
        matchScore: undefined,
      },
    });

    expect(view).toMatchObject({
      score: null,
      scoreState: 'hidden',
      canOpenProfile: false,
      canStartChat: false,
    });
  });

  it('summary가 없으면 nickname만 보존하고 모든 secondary control을 닫는다', () => {
    const view = toMatchingActiveView(activeMatch({ counterpartSummary: undefined }));

    expect(view).toMatchObject({
      nickname: '도윤',
      intro: null,
      score: null,
      scoreState: 'unavailable',
      canOpenProfile: false,
      canStartChat: false,
    });
  });
});
