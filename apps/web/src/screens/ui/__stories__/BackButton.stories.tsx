import type { Decorator, Meta, StoryObj } from '@storybook/nextjs-vite';
import { BackButton } from '../controls';

// The '이전 화면으로' button the not-found and Legal screens share, on the light palette both use. It
// goes back when the page before is another page of this site, and home otherwise; samePlacePaths
// names the addresses that count as this place (the Legal screens pass both documents).
const inLightFrame: Decorator = (Story) => (
  <div data-palette="light" className="bg-layer-default p-gutter font-body text-fg-neutral">
    <Story />
  </div>
);

const meta = {
  title: 'UI/BackButton',
  component: BackButton,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '이전 화면으로 단추. 바로 앞 기록이 이 사이트의 다른 화면이면 뒤로 가고, 처음 연 화면이거나 앞 기록이 같은 자리(samePlacePaths)면 홈으로 갑니다. 법적 문서 화면은 두 문서 주소를 같은 자리로 넘깁니다.',
      },
    },
  },
  decorators: [inLightFrame],
  args: { label: '이전 화면으로' },
} satisfies Meta<typeof BackButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };

export const LegalPlace: Story = {
  name: '법적 문서(같은 자리 두 주소)',
  args: { samePlacePaths: ['/terms', '/privacy'] },
};
