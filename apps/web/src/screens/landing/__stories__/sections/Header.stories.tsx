import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { Header } from '../../components/sections/Header';
import { frameArgTypes, inLandingFrame, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Sections/Header',
  component: Header,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '머리 띠: 로고와 서비스 이름, 로그인, 시작하기(가입의 헤더 줄임말, Owner 예외). 화면 폭과 상관없이 같은 세 가지만 둡니다. 로고는 홈 링크이고, Landing에서 누르면 새로고침 없이 맨 위로 가며 주소의 #섹션을 지웁니다.',
      },
    },
  },
  decorators: [inLandingFrame],
  args: { scheme: 'dark', logo: 'color' },
  argTypes: {
    ...frameArgTypes,
    logo: { control: 'inline-radio', options: ['color', 'white'] },
  },
} satisfies Meta<ComponentProps<typeof Header> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
export const WhiteLogo: Story = { name: '흰 로고', args: { logo: 'white' } };
