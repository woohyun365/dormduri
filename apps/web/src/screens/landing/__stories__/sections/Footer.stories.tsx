import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { Footer } from '../../components/sections/Footer';
import { frameArgTypes, inLandingFrame, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Sections/Footer',
  component: Footer,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '바닥 띠: 서비스(로그인), 약관과 정책, 서비스 외부 문의(주소는 링크가 아닌 글), 학교 공식 서비스 아님 고지.',
      },
    },
  },
  decorators: [inLandingFrame],
  args: { scheme: 'dark', logo: 'color' },
  argTypes: {
    ...frameArgTypes,
    logo: { control: 'inline-radio', options: ['color', 'white'] },
  },
} satisfies Meta<ComponentProps<typeof Footer> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
export const WhiteLogo: Story = { name: '흰 로고', args: { logo: 'white' } };
