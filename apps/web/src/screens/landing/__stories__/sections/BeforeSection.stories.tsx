import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { BeforeSection } from '../../components/sections/BeforeSection';
import { frameArgTypes, inLandingFrame, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Sections/Before',
  component: BeforeSection,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '무엇이 다른가요: 지금까지(커뮤니티 게시판 글)와 이제는(서비스 화면)을 겹친 두 브라우저 창. 창을 누르거나 위의 전환 버튼으로 앞에 올립니다.',
      },
    },
  },
  decorators: [inLandingFrame],
  args: { scheme: 'dark' },
  argTypes: { ...frameArgTypes },
} satisfies Meta<ComponentProps<typeof BeforeSection> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
