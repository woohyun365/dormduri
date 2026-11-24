import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Forbidden } from '../Forbidden';
import { Button, FormMessage, SecondaryButton, Section, TextAreaField, TextField } from '../forms';

// The shared form parts of src/ui/forms.tsx and the forbidden notice, in their current look.

const meta = {
  title: 'UI/Forms',
  decorators: [
    (Story) => (
      <div className="flex flex-col gap-6 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button>저장</Button>
      <SecondaryButton>취소</SecondaryButton>
      <Button disabled>처리 중</Button>
      <SecondaryButton disabled>처리 중</SecondaryButton>
    </div>
  ),
};

export const Fields: Story = {
  render: () => (
    <form aria-label="입력 예시" className="flex flex-col gap-4">
      <TextField id="story-email" name="email" label="이메일" type="email" />
      <TextField
        id="story-name"
        name="displayName"
        label="이름"
        hint="감사 기록과 승인 화면에 보이는 이름입니다."
      />
      <TextAreaField id="story-reason" name="reason" label="사유" hint="감사 기록에 남습니다." />
    </form>
  ),
};

export const Messages: Story = {
  render: () => (
    <>
      <FormMessage tone="success">초대 code를 만들었습니다.</FormMessage>
      <FormMessage tone="error">요청을 처리하지 못했습니다. 잠시 뒤 다시 시도하세요.</FormMessage>
    </>
  ),
};

export const SectionCard: Story = {
  render: () => (
    <Section id="story-section" title="이번 접속">
      <p className="text-body text-fg-description">절 안의 내용입니다.</p>
    </Section>
  ),
};

export const ForbiddenNotice: Story = {
  render: () => <Forbidden />,
};
