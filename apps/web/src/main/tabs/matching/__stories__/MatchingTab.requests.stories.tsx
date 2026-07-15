import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type {
  MatchingRequestCardView,
  MatchingRequestSectionView,
} from '../model/matching-request-view';
import { PairRequestSection } from '../sections/requests/PairRequestSection';

function request(
  id: string,
  direction: 'SENT' | 'RECEIVED',
  overrides: Partial<MatchingRequestCardView> = {},
): MatchingRequestCardView {
  return {
    id,
    counterpartUserId: `user-${id}`,
    direction,
    presentation: 'pending',
    nickname: direction === 'RECEIVED' ? `받은 요청 ${id}` : `보낸 요청 ${id}`,
    intro: '생활 리듬을 존중하며 조용하게 지내고 싶어요.',
    note: direction === 'RECEIVED' ? '서로 배려하면서 지내요.' : null,
    score: 87,
    scoreHiddenCopy: null,
    detailEntryToken: `detail-${id}`,
    canStartChat: false,
    createdAt: '2026-08-01T03:00:00.000Z',
    expiresAt: '2026-08-05T03:00:00.000Z',
    statusLabel: '응답 대기',
    actions: {
      canAccept: direction === 'RECEIVED',
      canReject: direction === 'RECEIVED',
      canCancel: direction === 'SENT',
      disabledReason: null,
      disabledReasonCopy: null,
      disabledReasonDescriptionId: null,
    },
    ...overrides,
  };
}

function section(
  sent: readonly MatchingRequestCardView[],
  received: readonly MatchingRequestCardView[],
) {
  const used = sent.filter((item) => item.presentation === 'pending').length;
  return {
    quota: { used, limit: 3, remaining: Math.max(0, 3 - used) },
    sent,
    received,
  } satisfies MatchingRequestSectionView;
}

const meta = {
  title: 'Main/MatchingTab/Runtime/Requests',
  component: PairRequestSection,
  args: {
    serverNow: '2026-08-01T03:00:00.000Z',
    roomSelectionDate: '2026-08-10',
    commands: {
      accept: async () => 'success' as const,
      reject: async () => 'success' as const,
      cancel: async () => 'success' as const,
      isPending: () => false,
    },
    onOpenProfile: () => undefined,
    onNavigateChat: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        component:
          'overview canonical ordering, server capability, pair-only request quota와 stale-safe decision UI를 검증합니다.',
      },
    },
  },
} satisfies Meta<typeof PairRequestSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { section: section([], []) } };
export const SentOneOfThree: Story = {
  args: { section: section([request('1', 'SENT')], []) },
};
export const SentQuotaFull: Story = {
  args: {
    section: section([request('1', 'SENT'), request('2', 'SENT'), request('3', 'SENT')], []),
  },
};
export const MultipleReceivedCanonicalOrder: Story = {
  args: {
    section: section([], [request('new', 'RECEIVED'), request('old', 'RECEIVED')]),
  },
};
export const ReceivedLongKoreanCopy: Story = {
  args: {
    section: section(
      [],
      [
        request('long-copy', 'RECEIVED', {
          nickname: '여러 줄로 자연스럽게 표시되어야 하는 아주 긴 룸메이트 닉네임',
          intro:
            '320px 모바일 화면에서도 소개와 핵심 action이 가려지지 않는지 확인하기 위한 아주 긴 한글 소개 문장입니다. 서로의 수면 시간과 공부 시간을 존중하면서 차분하고 안전하게 생활하고 싶어요.',
          note: '함께 보낸 메모도 줄임표로 숨기지 않고 충분한 높이에서 끝까지 읽을 수 있어야 해요. 공용 공간 사용 시간과 청소 약속을 미리 조율하고 싶습니다.',
          actions: {
            canAccept: false,
            canReject: false,
            canCancel: false,
            disabledReason: 'MATCH_PRECONDITION_FAILED',
            disabledReasonCopy:
              '매칭 조건이 변경되어 이 작업을 할 수 없어요. 최신 매칭 현황에서 다시 확인해주세요.',
            disabledReasonDescriptionId:
              'matching-action-disabled-reason-match_precondition_failed',
          },
        }),
      ],
    ),
  },
};
export const ScoreHiddenAndActionDisabled: Story = {
  args: {
    section: section(
      [],
      [
        request('disabled', 'RECEIVED', {
          score: null,
          scoreHiddenCopy: '현재 정책에서는 매칭 점수가 공개되지 않아요.',
          actions: {
            canAccept: false,
            canReject: false,
            canCancel: false,
            disabledReason: 'MATCH_PRECONDITION_FAILED',
            disabledReasonCopy: '매칭 조건이 변경되어 이 작업을 할 수 없어요.',
            disabledReasonDescriptionId:
              'matching-action-disabled-reason-match_precondition_failed',
          },
        }),
      ],
    ),
  },
};
export const SystemCancelledTerminal: Story = {
  args: {
    section: section(
      [],
      [
        request('cancelled', 'RECEIVED', {
          presentation: 'terminal',
          statusLabel: '요청 종료',
          actions: {
            canAccept: false,
            canReject: false,
            canCancel: false,
            disabledReason: null,
            disabledReasonCopy: null,
            disabledReasonDescriptionId: null,
          },
        }),
      ],
    ),
  },
};
