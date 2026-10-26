import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { BrandMark } from '../../components/BrandMark';
import { frameArgTypes, inLandingPanel, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Components/BrandMark',
  component: BrandMark,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '로고 기호와 서비스 이름(글자). 기호는 꾸밈이라 읽지 않습니다. 흰 기호는 어두운 면에서 고를 수 있고, large는 footer 크기입니다.',
      },
    },
  },
  decorators: [inLandingPanel],
  args: { scheme: 'dark', tone: 'color' },
  argTypes: { ...frameArgTypes, tone: { control: 'inline-radio', options: ['color', 'white'] } },
} satisfies Meta<ComponentProps<typeof BrandMark> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Color: Story = { name: '컬러' };
export const White: Story = { name: '흰색', args: { tone: 'white' } };
export const Large: Story = { name: '큰 크기(footer)', args: { large: true } };
