import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { StatementFields } from '../../components/StatementFields';
import { comparePairs } from '../../model/demoData';
import { frameArgTypes, inLandingFrame, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Components/StatementFields',
  component: StatementFields,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '나·상대 생활패턴 카드: 상대 카드를 끌어 내 카드에 겹치면 항목 쌍이 만나 비교됩니다. 휴대폰처럼 카드가 쌓이는 폭에서는 겹쳐 보기 버튼을 씁니다. 예시 답이고 실제 사용자 정보가 아닙니다.',
      },
    },
  },
  decorators: [inLandingFrame],
  args: { scheme: 'dark', pairs: comparePairs },
  argTypes: { ...frameArgTypes, pairs: { control: false } },
} satisfies Meta<ComponentProps<typeof StatementFields> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
