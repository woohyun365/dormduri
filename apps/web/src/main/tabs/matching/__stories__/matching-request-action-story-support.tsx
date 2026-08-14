import { useState } from 'react';
import type { StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { MatchingTabView } from '../MatchingTab';
import type { RequestActionCompletion } from '../hooks/useMatchingActions';
import type { MatchingRequestCommands } from '../sections/requests/PairRequestSection';
import {
  createCurrentActivity,
  createCurrentActivityEntry,
  createMatchingActiveMatch,
  createMatchingRequest,
  createMatchingRequestSection,
  createSeasonMatchingCurrent,
  matchingSeasonStory,
  matchingViewerHeader,
} from './matching-season-story-fixtures';
import { offSeasonHistoryContent } from './matching-off-season-story-support';

export type RequestActionStoryDecision = 'accept' | 'reject' | 'cancel';
export type RequestActionStoryOutcome = 'confirmation' | 'pending' | 'success' | 'state-changed';

const receivedRequest = createMatchingRequest('action-received', 'RECEIVED', {
  nickname: '민수',
  score: 92,
  expiresAt: '2026-08-04T03:00:00.000Z',
  canStartChat: true,
  hasActiveChatThread: true,
});
const sentRequest = createMatchingRequest('action-sent', 'SENT', {
  nickname: '서윤',
  score: 88,
  expiresAt: '2026-08-05T03:00:00.000Z',
  canStartChat: true,
  hasActiveChatThread: true,
});

function requestFor(decision: RequestActionStoryDecision) {
  return decision === 'cancel' ? sentRequest : receivedRequest;
}

function requestSectionFor(decision: RequestActionStoryDecision) {
  const request = requestFor(decision);
  return decision === 'cancel'
    ? createMatchingRequestSection([request], [])
    : createMatchingRequestSection([], [request]);
}

export function createMatchingRequestActionStory(input: {
  readonly decision: RequestActionStoryDecision;
  readonly outcome: RequestActionStoryOutcome;
}): StoryObj<typeof MatchingTabView> {
  const base = matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent({
        requestSection: requestSectionFor(input.decision),
      }),
    },
    input.decision === 'cancel'
      ? 'season-matching:sent-request'
      : 'season-matching:received-request',
    { pastContent: offSeasonHistoryContent() },
  );

  return {
    ...base,
    render: () => <MatchingRequestActionStoryCanvas {...input} />,
    play: async ({ canvas, userEvent }) => {
      const portal = within(document.body);
      const actionLabel = {
        accept: '수락',
        reject: '거절',
        cancel: '요청 취소',
      }[input.decision];
      const confirmLabel = {
        accept: '수락하기',
        reject: '거절하기',
        cancel: '요청 취소하기',
      }[input.decision];
      const dialogName = {
        accept: '매칭 요청을 수락할까요?',
        reject: '매칭 요청을 거절할까요?',
        cancel: '보낸 요청을 취소할까요?',
      }[input.decision];

      await userEvent.click(await canvas.findByRole('button', { name: actionLabel }));
      await expect(portal.getByRole('dialog', { name: dialogName })).toBeVisible();

      if (input.outcome === 'confirmation') return;

      await userEvent.click(portal.getByRole('button', { name: confirmLabel }));
      if (input.outcome === 'pending') {
        await expect(portal.getByRole('button', { name: '처리 중…' })).toBeDisabled();
      } else if (input.outcome === 'state-changed') {
        await expect(canvas.getByRole('alert')).toHaveTextContent(
          '매칭 상태가 변경되었어요. 최신 상태를 다시 확인해주세요.',
        );
      } else if (input.decision === 'accept') {
        await expect(portal.getByRole('dialog', { name: '매칭 완료' })).toBeVisible();
      } else {
        const completionTitle =
          input.decision === 'reject' ? '매칭 요청을 거절했어요.' : '보낸 매칭 요청을 취소했어요.';
        await expect(portal.getByRole('dialog', { name: completionTitle })).toBeVisible();
        await expect(canvas.getByRole('heading', { name: '활동 이력' })).toBeVisible();
      }
    },
  };
}

function MatchingRequestActionStoryCanvas({
  decision,
  outcome,
}: {
  readonly decision: RequestActionStoryDecision;
  readonly outcome: RequestActionStoryOutcome;
}) {
  const request = requestFor(decision);
  const [current, setCurrent] = useState(() =>
    createSeasonMatchingCurrent({
      requestSection: requestSectionFor(decision),
    }),
  );
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestCompletion, setRequestCompletion] = useState<RequestActionCompletion | null>(null);
  const [celebration, setCelebration] = useState<string | null>(null);

  const run = async (nextDecision: RequestActionStoryDecision) => {
    if (nextDecision !== decision) return 'error' as const;
    if (outcome === 'pending') {
      setPending(true);
      return new Promise<'success'>(() => undefined);
    }
    if (outcome === 'state-changed') {
      setRequestError('매칭 상태가 변경되었어요. 최신 상태를 다시 확인해주세요.');
      return 'state-changed' as const;
    }
    if (outcome !== 'success') return 'error' as const;

    if (nextDecision === 'accept') {
      setCurrent(
        createSeasonMatchingCurrent({
          activeMatch: createMatchingActiveMatch({ counterpartNickname: request.nickname }),
          requestSection: createMatchingRequestSection(),
        }),
      );
      setCelebration(request.nickname);
    } else {
      const cancelled = nextDecision === 'cancel';
      setCurrent(
        createSeasonMatchingCurrent({
          requestSection: createMatchingRequestSection(),
          activity: createCurrentActivity([
            createCurrentActivityEntry(cancelled ? 'cancelled-action' : 'rejected-action', {
              counterpartNickname: request.nickname,
              stage: cancelled ? 'SENT_REQUEST' : 'RECEIVED_REQUEST',
              direction: cancelled ? 'SENT' : 'RECEIVED',
              result: cancelled ? 'REQUEST_CANCELLED' : 'REQUEST_REJECTED',
              requestTerminalReason: cancelled ? 'CANCELLED_BY_REQUESTER' : 'REJECTED_BY_RECEIVER',
              occurredAt: '2026-08-01T03:00:00.000Z',
            }),
          ]),
        }),
      );
      setRequestCompletion({
        action: cancelled ? 'cancelRequest' : 'rejectRequest',
        requestId: request.id,
        message: cancelled ? '보낸 매칭 요청을 취소했어요.' : '매칭 요청을 거절했어요.',
      });
    }
    return 'success' as const;
  };

  const commands: MatchingRequestCommands = {
    accept: () => run('accept'),
    reject: () => run('reject'),
    cancel: () => run('cancel'),
    isPending: (action, id) => pending && id === request.id && action === `${decision}Request`,
  };

  return (
    <MatchingTabView
      state={{ kind: 'season-matching', current }}
      viewerHeader={matchingViewerHeader}
      selectedSection="current"
      requestCommands={commands}
      requestActionError={requestError}
      requestActionCompletion={requestCompletion}
      celebration={celebration}
      onDismissRequestActionError={() => setRequestError(null)}
      onDismissRequestActionCompletion={() => setRequestCompletion(null)}
      onCloseCelebration={() => setCelebration(null)}
      onNavigateChat={() => undefined}
      pastContent={offSeasonHistoryContent()}
    />
  );
}
