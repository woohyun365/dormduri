import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, waitFor } from 'storybook/test';
import { MatchingTabView } from '../MatchingTab';
import { offSeasonHistoryContent, offSeasonStoryState } from './matching-off-season-story-support';
import { matchingHistorySummary, matchingSeasonStory } from './matching-season-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Season Open/Policy',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'SEASON_OPEN current-state guidance. The viewer completes season registration first and waits for SEASON_MATCHING before match requests and responses become available.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type SeasonOpenPolicyStory = StoryObj<typeof MatchingTabView>;

export const RegistrationAndMatchingWait: SeasonOpenPolicyStory = {
  ...matchingSeasonStory(
    {
      kind: 'season-open',
      historySummary: offSeasonStoryState.historySummary,
    },
    'season-open:history',
    {
      selectedSection: 'current',
      pastContent: offSeasonHistoryContent(),
    },
  ),
  name: 'Registration And Matching Wait',
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tab', { name: '현재 매칭' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(canvas.getByText('시즌 등록을 완료해 주세요.')).toBeInTheDocument();
    await expect(canvas.getByText('매칭 요청은 시즌 매칭 기간에 열려요.')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /요청 보내기|수락|거절/ })).toBeNull();
  },
};

export const Deregistered: SeasonOpenPolicyStory = {
  ...matchingSeasonStory(
    {
      kind: 'deregistered',
      seasonState: 'SEASON_OPEN',
      historySummary: matchingHistorySummary,
      activity: [],
    },
    'season-open:deregistered-gate',
    {
      selectedSection: 'current',
      pastContent: offSeasonHistoryContent(),
    },
  ),
  name: 'Deregistered',
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole('heading', { name: '시즌 참여를 취소했어요' })).toBeVisible(),
    );
    await expect(canvas.queryByRole('heading', { name: '활동 이력' })).not.toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: '시즌 등록 확인하기' })).toBeNull();
  },
};
