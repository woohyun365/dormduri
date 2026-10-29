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
          '랜딩 전체 화면(Glide 구조). 어두운 판이 기본이고 밝은 판이 있습니다. darkLogo는 어두운 판 header·footer의 로고 색입니다.',
      },
      story: { inline: false, height: '720px' },
    },
  },
  args: { scheme: 'dark' },
  argTypes: {
    scheme: { control: 'inline-radio', options: ['dark', 'light'] },
    darkLogo: { control: 'inline-radio', options: ['color', 'white'] },
  },
} satisfies Meta<typeof LandingScreen>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Dark: Story = { name: '어두운 판' };
export const Light: Story = { name: '밝은 판', args: { scheme: 'light' } };
