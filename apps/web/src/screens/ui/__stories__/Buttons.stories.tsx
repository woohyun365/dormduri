import type { Decorator, Meta, StoryObj } from '@storybook/nextjs-vite';
import { controlButton, quietButton } from '../controls';

// The two button looks the not-found and Legal screens share, on the light palette both use. A shared
// part has no feature frame to borrow, so the decorator gives the frame's palette and layer classes.
const inLightFrame: Decorator = (Story) => (
  <div data-palette="light" className="bg-layer-default p-gutter font-body text-fg-neutral">
    <Story />
  </div>
);

function ButtonSamples() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a href="#sample" className={controlButton}>
        주 단추
      </a>
      <button type="button" className={controlButton}>
        주 단추(button)
      </button>
      <a href="#sample" className={quietButton}>
        조용한 단추
      </a>
    </div>
  );
}

const meta = {
  title: 'UI/Buttons',
  component: ButtonSamples,
  tags: ['knu-layer', 'autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '404·법적 문서 화면이 함께 쓰는 단추 모양: 모서리가 작은 control 반경에 brand 채움이 없습니다. 주 단추는 중립 테두리, 조용한 단추는 글자이고 hover에 밑줄이 생깁니다. 크기는 주 행동 목표 크기 이상입니다.',
      },
    },
  },
  decorators: [inLightFrame],
} satisfies Meta<typeof ButtonSamples>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { name: '기본' };
