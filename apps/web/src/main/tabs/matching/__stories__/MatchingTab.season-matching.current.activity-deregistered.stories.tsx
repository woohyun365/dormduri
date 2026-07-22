import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, waitFor } from 'storybook/test';
import { MatchingTabView } from '../MatchingTab';
import { offSeasonHistoryContent } from './matching-off-season-story-support';
import {
  createCurrentActivity,
  createCurrentActivityEntry,
  matchingHistorySummary,
  matchingSeasonStory,
} from './matching-season-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Season Matching/Current/Activity',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'SEASON_MATCHING 중 참여 철회로 terminal 처리된 viewer-owned request activity를 read-only로 확인합니다. 요청 관리와 신규 action은 렌더링하지 않습니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type Story = StoryObj<typeof MatchingTabView>;

export const Deregistered: Story = {
  ...matchingSeasonStory(
    {
      kind: 'deregistered',
      seasonState: 'SEASON_MATCHING',
      historySummary: matchingHistorySummary,
      activity: createCurrentActivity([
        createCurrentActivityEntry('withdrawn-sent', {
          counterpartNickname: '다온',
          result: 'REQUEST_CANCELLED',
          occurredAt: '2026-08-06T03:00:00.000Z',
          requestTerminalReason: 'WITHDRAWN_PARTICIPANT',
        }),
        createCurrentActivityEntry('withdrawn-received', {
          counterpartNickname: '새별',
          direction: 'RECEIVED',
          stage: 'RECEIVED_REQUEST',
          result: 'REQUEST_CANCELLED',
          occurredAt: '2026-08-06T03:00:00.000Z',
          requestTerminalReason: 'WITHDRAWN_PARTICIPANT',
        }),
      ]),
    },
    'season-matching:deregistered-activity',
    { selectedSection: 'current', pastContent: offSeasonHistoryContent() },
  ),
  name: 'Deregistered',
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(
        canvas.getByRole('heading', { name: '이번 시즌 참여가 종료된 상태예요' }),
      ).toBeVisible(),
    );
    await expect(canvas.getByRole('heading', { name: '활동 이력' })).toBeVisible();
    await expect(canvas.getAllByText('시즌 참여 취소 요청이 종료됐어요.')).not.toHaveLength(0);
    await expect(canvas.queryByText('요청 관리')).not.toBeInTheDocument();
  },
};
