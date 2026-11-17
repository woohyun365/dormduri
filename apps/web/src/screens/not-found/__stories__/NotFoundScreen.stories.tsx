import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NotFoundScreen } from '../NotFoundScreen';

// The not-found screen as app/not-found.tsx renders it for an address this site does not have.

const meta = {
  title: 'NotFound/Page',
  component: NotFoundScreen,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '없는 주소의 화면. 흰 배경(밝은 판)에 로고, 제목, 한 줄 안내, 홈으로·이전 화면으로 단추를 둡니다. 응답 코드는 404입니다.',
      },
      story: { inline: false, height: '560px' },
    },
  },
} satisfies Meta<typeof NotFoundScreen>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
