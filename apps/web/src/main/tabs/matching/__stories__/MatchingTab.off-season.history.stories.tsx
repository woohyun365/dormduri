import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { MatchingTabView } from '../MatchingTab';
import { offSeasonHistoryContent, offSeasonStoryState } from './matching-off-season-story-support';
import { matchingSeasonStory } from './matching-season-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Off Season/History',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'Ended-season archive scenarios. Season cards summarize final success, unique request counterparts, and chat counterpart statistics; request and match events remain in the timeline.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type OffSeasonHistoryStory = StoryObj<typeof MatchingTabView>;

export const SeasonArchive: OffSeasonHistoryStory = {
  ...matchingSeasonStory(offSeasonStoryState, 'off-season:history', {
    pastContent: offSeasonHistoryContent(),
  }),
  name: 'Season Archive',
  play: async ({ canvas, userEvent }) => {
    const season = canvas.getByRole('button', { name: /2026년 1학기/ });
    await expect(season).toHaveTextContent('받은 요청');
    await expect(season).toHaveTextContent('3명');
    await expect(season).toHaveTextContent('보낸 요청');
    await expect(season).toHaveTextContent('5명');
    await expect(season).toHaveTextContent('대화한 상대');
    await expect(season).toHaveTextContent('4명');
    await userEvent.click(season);
    const activity = canvas.getByRole('list', { name: '2026년 1학기 활동 이력' });
    const rows = canvas.getAllByRole('listitem').filter((row) => activity.contains(row));
    await expect(rows.at(-2)).toHaveTextContent('매칭 완료');
    await expect(rows.at(-1)).toHaveTextContent('요청 4건 자동 종료');
    await userEvent.click(canvas.getByText('요청 4건 자동 종료'));
    await expect(activity).toHaveTextContent('받은 요청 · 자동 종료');
    await expect(activity).toHaveTextContent('보낸 요청 · 자동 종료');
    await userEvent.click(canvas.getByRole('button', { name: /2025년 2학기/ }));
    await expect(canvas.getByLabelText('매칭 상대 매칭 미성사')).toHaveTextContent(
      '상대 시즌 프로필 없음',
    );
    const endedSeason = canvas.getByRole('region', { name: /2025년 2학기/ });
    await expect(endedSeason).not.toHaveTextContent('매칭 관계');
    const endedActivity = canvas.getByRole('list', { name: '2025년 2학기 활동 이력' });
    await expect(endedActivity).toHaveTextContent('요청 1건 자동 종료');
    await expect(endedActivity).not.toHaveTextContent('내 매칭 확정 · 받은 요청 · 새별');
    await userEvent.click(canvas.getByText('요청 1건 자동 종료'));
    await expect(endedActivity).toHaveTextContent('새별');
    await expect(endedActivity).toHaveTextContent('받은 요청 · 자동 종료');
    await expect(endedActivity).toHaveTextContent('매칭 후 해제');
    await expect(endedActivity).toHaveTextContent('매칭 해제 · 노을');

    await userEvent.click(canvas.getByRole('button', { name: /이전 시즌 1개 더 보기/ }));
    await userEvent.click(canvas.getByRole('button', { name: /2024년 2학기/ }));
    const noMatchActivity = canvas.getByRole('list', { name: '2024년 2학기 활동 이력' });
    const noMatchHistory = within(noMatchActivity);
    await expect(noMatchHistory.getAllByText('요청 1건 자동 종료')).toHaveLength(4);
    await expect(noMatchActivity).toHaveTextContent('상대 매칭 확정으로 정리됐어요.');
    await expect(noMatchActivity).toHaveTextContent('시즌 참여 취소 요청이 종료됐어요.');
    await userEvent.click(noMatchHistory.getByText('시즌 참여 취소 요청이 종료됐어요.'));
    await expect(noMatchActivity).toHaveTextContent('가람');
    await userEvent.click(noMatchHistory.getAllByText('상대 매칭 확정으로 정리됐어요.')[0]!);
    await expect(noMatchActivity).toHaveTextContent('별하');
    await expect(noMatchActivity).toHaveTextContent('보낸 요청 · 자동 종료');
    await expect(noMatchActivity).toHaveTextContent(
      '매칭 참여 조건이 충족되지 않아 요청이 종료됐어요.',
    );
    await userEvent.click(
      noMatchHistory.getByText('매칭 참여 조건이 충족되지 않아 요청이 종료됐어요.'),
    );
    await expect(noMatchActivity).toHaveTextContent('산들');
    await expect(noMatchActivity).toHaveTextContent('받은 요청 · 자동 종료');
    await expect(noMatchActivity).toHaveTextContent('요청 거절');
    await expect(noMatchActivity).toHaveTextContent('요청 만료');
  },
};

export const EmptyArchive: OffSeasonHistoryStory = {
  ...matchingSeasonStory(
    {
      kind: 'off-season',
      historySummary: { seasons: 0, matchedCount: 0, unmatchedCount: 0 },
    },
    'off-season:history',
    {
      selectedSection: 'past',
      pastContent: offSeasonHistoryContent({ items: [] }, undefined, { current: null, past: [] }),
    },
  ),
  name: 'Empty Archive',
};
