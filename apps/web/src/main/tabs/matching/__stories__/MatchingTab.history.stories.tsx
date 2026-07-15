import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { createMatchHistoryResponse } from '@/test/home-profile-detail-fixtures';
import { MatchHistorySection } from '../sections/history/MatchHistorySection';

const baseHistory = createMatchHistoryResponse();

const meta = {
  title: 'Main/MatchingTab/Runtime/History',
  component: MatchHistorySection,
  args: {
    data: baseHistory,
    loading: false,
    error: null,
    onRetry: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        component:
          'pair-only 과거 매칭 기록입니다. 최종 MATCHED_SUCCESS만 entry-id 결과 읽기 상세를 열며, detail의 점수는 materialized snapshot입니다.',
      },
    },
  },
} satisfies Meta<typeof MatchHistorySection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Matched: Story = {};
export const Empty: Story = { args: { data: { items: [] } } };
export const Loading: Story = { args: { data: null, loading: true } };
export const Unmatched: Story = {
  args: {
    data: {
      items: [
        {
          ...baseHistory.items[0]!,
          finalResult: 'UNMATCHED_AFTER_SUCCESS',
          history: [
            {
              ...baseHistory.items[0]!.history[0]!,
              result: 'UNMATCHED_AFTER_SUCCESS',
              unmatchedAt: '2026-08-07T00:00:00.000Z',
              activeMatchEndReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
            },
          ],
        },
      ],
    },
  },
};
export const SeasonEnded: Story = {
  args: {
    data: {
      items: [
        {
          ...baseHistory.items[0]!,
          finalResult: 'UNMATCHED_AFTER_SUCCESS',
          history: [
            {
              ...baseHistory.items[0]!.history[0]!,
              result: 'UNMATCHED_AFTER_SUCCESS',
              unmatchedAt: '2026-08-07T00:00:00.000Z',
              activeMatchEndReason: 'SEASON_ENDED',
            },
          ],
        },
      ],
    },
  },
};
export const AdminEnded: Story = {
  args: {
    data: {
      items: [
        {
          ...baseHistory.items[0]!,
          finalResult: 'UNMATCHED_AFTER_SUCCESS',
          history: [
            {
              ...baseHistory.items[0]!.history[0]!,
              result: 'UNMATCHED_AFTER_SUCCESS',
              unmatchedAt: '2026-08-07T00:00:00.000Z',
              activeMatchEndReason: 'ADMIN_ACTION',
            },
          ],
        },
      ],
    },
  },
};
export const LongKoreanCopy: Story = {
  args: {
    data: {
      items: [
        {
          ...baseHistory.items[0]!,
          seasonName: '2026년 1학기 아주 긴 기숙사 배정 및 매칭 결과 확인 시즌',
          history: [
            {
              ...baseHistory.items[0]!.history[0]!,
              counterpartNickname: '여러 줄로 자연스럽게 표시되어야 하는 아주 긴 상대 닉네임',
            },
          ],
        },
      ],
    },
  },
};
