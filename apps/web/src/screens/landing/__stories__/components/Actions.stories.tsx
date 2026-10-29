import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ComponentProps } from 'react';
import { LoginLink, SignupLink } from '../../components/actions';
import { landingCopy } from '../../model/landingCopy';
import { frameArgTypes, inLandingPanel, type FrameArgs } from '../storyFrame';

const meta = {
  title: 'Landing/Components/Actions',
  component: SignupLink,
  subcomponents: { LoginLink },
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '랜딩의 두 행동: 가입(/signup)과 로그인(/login). 가입은 어디서나 "학교 이메일로 시작하기" 한 이름이고, 헤더만 줄임말 "시작하기"를 씁니다(Owner 예외).',
      },
    },
  },
  decorators: [inLandingPanel],
  args: { scheme: 'dark' },
  argTypes: { ...frameArgTypes, children: { control: false } },
} satisfies Meta<ComponentProps<typeof SignupLink> & FrameArgs>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Signup: Story = { name: '가입' };
export const SignupShort: Story = {
  name: '가입 · 헤더 줄임말',
  args: { children: landingCopy.startLabel },
};
export const Login: Story = { name: '로그인', render: () => <LoginLink /> };
