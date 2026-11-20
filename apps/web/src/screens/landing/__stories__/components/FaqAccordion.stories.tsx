import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { FaqAccordion } from '../../components/FaqAccordion';
import { faqItems } from '../../model/landingCopy';
import { inLandingPanel } from '../storyFrame';

const meta = {
  title: 'Landing/Components/FaqAccordion',
  component: FaqAccordion,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    docs: {
      description: {
        component: '그 자리에서 펼치는 질문 목록(details·summary). script 없이도 열립니다.',
      },
    },
  },
  decorators: [inLandingPanel],
  args: { items: faqItems },
} satisfies Meta<ComponentProps<typeof FaqAccordion>>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
