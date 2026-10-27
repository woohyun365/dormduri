import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { CommunityPost, ServiceWindow } from '../../components/CommunityPost';
import { frameArgTypes, inLandingPanel, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Components/CommunityPost',
  component: CommunityPost,
  subcomponents: { ServiceWindow },
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '"무엇이 다른가요"의 두 브라우저 창(macOS Chrome 모양): 커뮤니티 게시판의 룸메이트 구인 글(체크리스트, 예시 글)과 서비스 메인 화면 캡처 자리(ServiceWindow).',
      },
    },
  },
  decorators: [inLandingPanel],
  args: { scheme: 'dark' },
  argTypes: { ...frameArgTypes },
} satisfies Meta<ComponentProps<typeof CommunityPost> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Post: Story = { name: '게시판 글' };
export const Service: Story = {
  name: '서비스 창',
  render: () => <ServiceWindow />,
};
