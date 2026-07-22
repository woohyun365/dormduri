import type { Meta } from '@storybook/nextjs-vite';
import { MatchingTabView } from '../MatchingTab';
import { createMatchingRequestActionStory } from './matching-request-action-story-support';

const meta = {
  title: 'Main/MatchingTab/Season Matching/Action/Reject',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          '거절은 stale 매칭 조건과 무관하게 pending 요청을 정리하는 cleanup action입니다. 정상 확인, 처리 중, 완료 feedback, 동시 상태 변경을 production UI로 비교합니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;

export const Confirmation = createMatchingRequestActionStory({
  decision: 'reject',
  outcome: 'confirmation',
});
export const Pending = createMatchingRequestActionStory({
  decision: 'reject',
  outcome: 'pending',
});
export const Success = createMatchingRequestActionStory({
  decision: 'reject',
  outcome: 'success',
});
export const StateChanged = createMatchingRequestActionStory({
  decision: 'reject',
  outcome: 'state-changed',
});
