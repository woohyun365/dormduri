import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { MatchingTabView } from '../MatchingTab';
import { createMatchingRequestActionStory } from './matching-request-action-story-support';
import {
  createMatchingRequest,
  createMatchingRequestSection,
  createSeasonMatchingCurrent,
  matchingSeasonStory,
} from './matching-season-story-fixtures';
import { offSeasonHistoryContent } from './matching-off-season-story-support';

const meta = {
  title: 'Main/MatchingTab/Season Matching/Action/Accept',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          '받은 요청 수락은 command 직전까지 transaction precondition을 다시 확인합니다. 정상 확인, 중복 제출 방지, 성공 전환, 상태 변경 복구를 production UI로 비교합니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;
type Story = StoryObj<typeof MatchingTabView>;

export const Confirmation = createMatchingRequestActionStory({
  decision: 'accept',
  outcome: 'confirmation',
});
export const Pending = createMatchingRequestActionStory({
  decision: 'accept',
  outcome: 'pending',
});
export const Success = createMatchingRequestActionStory({
  decision: 'accept',
  outcome: 'success',
});
export const StateChanged = createMatchingRequestActionStory({
  decision: 'accept',
  outcome: 'state-changed',
});

const preconditionChangedRequest = createMatchingRequest(
  'accept-precondition-changed',
  'RECEIVED',
  {
    nickname: '유진',
    actions: {
      accept: {
        allowed: false,
        reason: 'MATCH_PRECONDITION_FAILED',
        reasonCopy: '매칭 조건이 변경되어 이 작업을 할 수 없어요.',
        reasonDescriptionId:
          'matching-action-accept-precondition-changed-accept-reason-match_precondition_failed',
      },
      reject: { allowed: true, reason: null, reasonCopy: null, reasonDescriptionId: null },
      cancel: { allowed: false, reason: null, reasonCopy: null, reasonDescriptionId: null },
    },
  },
);

export const PreconditionChanged: Story = {
  ...matchingSeasonStory(
    {
      kind: 'season-matching',
      current: createSeasonMatchingCurrent({
        requestSection: createMatchingRequestSection([], [preconditionChangedRequest]),
      }),
    },
    'season-matching:received-request',
    { pastContent: offSeasonHistoryContent() },
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: '수락' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: '거절' })).toBeEnabled();
    await expect(canvas.getByText('매칭 조건이 변경되어 이 작업을 할 수 없어요.')).toBeVisible();
  },
};
