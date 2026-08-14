import type { Meta } from '@storybook/nextjs-vite';
import { MatchingTabView } from '../MatchingTab';
import { createMatchingRequestActionStory } from './matching-request-action-story-support';

const meta = {
  title: 'Main/MatchingTab/Season Matching/Action/Cancel',
  component: MatchingTabView,
  parameters: {
    docs: {
      description: {
        component:
          '보낸 요청 취소는 해당 pending 요청만 종료하는 cleanup action입니다. 정상 확인, 처리 중, 완료 feedback, 동시 상태 변경을 production UI로 비교합니다.',
      },
    },
  },
} satisfies Meta<typeof MatchingTabView>;

export default meta;

export const Confirmation = createMatchingRequestActionStory({
  decision: 'cancel',
  outcome: 'confirmation',
});
export const Pending = createMatchingRequestActionStory({
  decision: 'cancel',
  outcome: 'pending',
});
export const Success = createMatchingRequestActionStory({
  decision: 'cancel',
  outcome: 'success',
});
export const StateChanged = createMatchingRequestActionStory({
  decision: 'cancel',
  outcome: 'state-changed',
});
