import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import LandingPage from '../LandingPage';

const meta = {
  title: 'Public/Landing/Page',
  component: LandingPage,
  parameters: {
    docs: {
      description: {
        component:
          'Production LandingPage를 그대로 렌더링하는 공개 페이지 PC/Mobile visual workshop입니다.',
      },
    },
  },
} satisfies Meta<typeof LandingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MobileNavigation: Story = {
  parameters: {
    viewport: { defaultViewport: 'webMobile390' },
  },
  play: async ({ canvas, userEvent }) => {
    const menuButton = canvas.getByRole('button', { name: '메뉴' });
    await userEvent.click(menuButton);
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByRole('navigation', { name: '랜딩 모바일 내비게이션' })).toBeVisible();
  },
};

export const SmallMobile: Story = {
  parameters: {
    viewport: { defaultViewport: 'webMobile320' },
  },
};

export const DesktopWide: Story = {
  parameters: {
    viewport: { defaultViewport: 'webDesktop1440' },
  },
};
