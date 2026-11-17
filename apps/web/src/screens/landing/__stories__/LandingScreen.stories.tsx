import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LandingScreen } from '../LandingScreen';

// The whole landing page. Each section and part has its own stories under Landing/Sections and
// Landing/Components. Not visual-tagged: the landing keeps no screenshot baselines.

const meta = {
  title: 'Landing/Page',
  component: LandingScreen,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '랜딩 전체 화면(Glide 구조). 어두운 판 하나이고 OS 색 설정을 따르지 않습니다. darkLogo는 header·footer의 로고 색입니다.',
      },
      story: { inline: false, height: '720px' },
    },
  },
  argTypes: {
    darkLogo: { control: 'inline-radio', options: ['color', 'white'] },
  },
} satisfies Meta<typeof LandingScreen>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
