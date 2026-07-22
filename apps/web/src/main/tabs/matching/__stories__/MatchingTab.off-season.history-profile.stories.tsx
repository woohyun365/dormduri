import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { MatchingTabView } from '../MatchingTab';
import { offSeasonHistoryContent, offSeasonStoryState } from './matching-off-season-story-support';
import { matchingSeasonStory } from './matching-season-story-fixtures';

const meta = {
  title: 'Main/MatchingTab/Off Season/History/Profile',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          'Read-only season profile actions: the viewer registration snapshot and, for final MATCHED_SUCCESS, a retained counterpart snapshot or privacy-preserving tombstone.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type OffSeasonHistoryProfileStory = StoryObj<typeof MatchingTabView>;

export const SavedMatchSnapshot: OffSeasonHistoryProfileStory = {
  ...matchingSeasonStory(offSeasonStoryState, 'off-season:history-profile', {
    pastContent: offSeasonHistoryContent(),
  }),
  name: 'Saved Match Snapshot',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /2026년 1학기/ }));
    await userEvent.click(
      canvas.getByRole('button', { name: /매칭 상대.*감자친구.*상대 시즌 프로필/ }),
    );
    await expect(canvas.getByText('매칭도 92점')).toBeInTheDocument();
  },
};

export const MySeasonProfile: OffSeasonHistoryProfileStory = {
  ...matchingSeasonStory(offSeasonStoryState, 'off-season:history-profile', {
    pastContent: offSeasonHistoryContent(),
  }),
  name: 'My Season Profile',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /2026년 1학기/ }));
    await userEvent.click(
      canvas.getByRole('button', { name: /나 해당 시즌 프로필 2026년 1학기 등록 정보/ }),
    );
    await expect(
      canvas.getByText('2026년 1학기에는 조용한 생활과 깔끔한 정리를 중요하게 생각했어요.'),
    ).toBeInTheDocument();
  },
};

export const DeidentifiedCounterpart: OffSeasonHistoryProfileStory = {
  ...matchingSeasonStory(offSeasonStoryState, 'off-season:history-profile', {
    pastContent: offSeasonHistoryContent(),
  }),
  name: 'Deidentified Counterpart',
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /2025년 1학기/ }));
    await userEvent.click(
      canvas.getByRole('button', { name: /매칭 상대 탈퇴한 사용자 상대 시즌 프로필/ }),
    );
    await expect(canvas.getByText('탈퇴한 사용자')).toBeInTheDocument();
    await expect(
      canvas.getByText('탈퇴하거나 비식별 처리된 상대의 프로필은 당시 기록에서도 공개하지 않아요.'),
    ).toBeInTheDocument();
  },
};
