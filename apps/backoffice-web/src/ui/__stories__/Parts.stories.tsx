import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, waitFor } from 'storybook/test';
import { Button } from '../Button';
import { Card } from '../Card';
import { EmptyState as EmptyStatePart } from '../EmptyState';
import { SelectField, TextAreaField, TextField } from '../fields';
import { Forbidden } from '../Forbidden';
import { Icon } from '../icons';
import { Notice } from '../Notice';
import { Overlay } from '../Overlay';
import { StatusBadge } from '../status';
import { TD, TH, TableRegion } from '../table';
import { TimeText } from '../text';

// The shared parts of src/ui (design guide ⑥) in the confirmed look.

const meta = {
  title: 'UI/Parts',
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button>저장</Button>
        <Button tone="secondary">취소</Button>
        <Button tone="danger">거절</Button>
        <Button tone="danger-solid">비활성화</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm">
          <Icon name="plus" className="size-4" />
          작은 단추
        </Button>
        <Button tone="secondary" size="sm">
          닫기
        </Button>
        <Button disabled>처리 중</Button>
        <Button tone="secondary" disabled>
          처리 중
        </Button>
      </div>
      <div className="max-w-60">
        <Button tone="secondary" wrap>
          <Icon name="refresh" className="size-4 shrink-0" />
          복구 code 새로 발급(이전 code는 쓸 수 없게 됨)
        </Button>
      </div>
    </div>
  ),
};

export const Fields: Story = {
  render: () => (
    <form aria-label="입력 예시" className="flex max-w-narrow flex-col gap-4">
      <TextField id="story-email" name="email" label="이메일" type="email" />
      <TextField
        id="story-name"
        name="displayName"
        label="이름"
        hint="감사 기록과 승인 화면에 보이는 이름입니다."
      />
      <SelectField id="story-kind" name="kind" label="종류">
        <option value="ROLE_GRANT">역할 부여</option>
        <option value="ROLE_REVOKE">역할 회수</option>
      </SelectField>
      <TextAreaField id="story-reason" name="reason" label="사유" hint="감사 기록에 남습니다." />
    </form>
  ),
};

export const Messages: Story = {
  render: () => (
    <>
      <Notice tone="success" role="status">
        초대 code를 만들었습니다.
      </Notice>
      <Notice tone="danger" role="alert">
        요청을 처리하지 못했습니다. 잠시 뒤 다시 시도하세요.
      </Notice>
      <Notice tone="warning" role="alert">
        15분 동안 활동이 없어 접속이 끝났습니다.
      </Notice>
      <Notice tone="info" role="status">
        내 역할 회수를 승인해 이 접속이 끝났습니다.
      </Notice>
    </>
  ),
};

export const SectionCard: Story = {
  render: () => (
    <Card id="story-section" title="내 접속" action={<StatusBadge meaning="info">2개</StatusBadge>}>
      <p className="text-body text-fg-description">절 안의 내용입니다.</p>
    </Card>
  ),
};

export const ForbiddenNotice: Story = {
  render: () => <Forbidden />,
};

export const StatusBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <StatusBadge meaning="pending">대기</StatusBadge>
      <StatusBadge meaning="info">진행</StatusBadge>
      <StatusBadge meaning="success">완료</StatusBadge>
      <StatusBadge meaning="warning">주의</StatusBadge>
      <StatusBadge meaning="danger">실패</StatusBadge>
    </div>
  ),
};

export const EmptyState: Story = {
  render: () => (
    <EmptyStatePart icon="access" title="요청이 없습니다.">
      새 요청을 만들면 여기에 보입니다.
    </EmptyStatePart>
  ),
};

export const Table: Story = {
  render: () => (
    <Card id="story-table" title="표" flush>
      <TableRegion label="예시 표">
        <table className="w-full border-t border-stroke-subtle">
          <thead>
            <tr>
              <th scope="col" className={TH}>
                이름
              </th>
              <th scope="col" className={TH}>
                상태
              </th>
              <th scope="col" className={TH}>
                마지막 로그인(KST)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stroke-row">
            <tr>
              <td className={`${TD} font-semibold`}>운영자 하나</td>
              <td className={TD}>
                <StatusBadge meaning="success">활성</StatusBadge>
              </td>
              <td className={`${TD} tabular-nums`}>
                <TimeText text="2026-11-24 09:30" />
              </td>
            </tr>
          </tbody>
        </table>
      </TableRegion>
    </Card>
  ),
};

function DrawerExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="self-start" onClick={() => setOpen(true)}>
        drawer 열기
      </Button>
      {open ? (
        <Overlay
          id="story-drawer"
          title="운영자 초대"
          onClose={() => setOpen(false)}
          footer={
            <Button type="submit" form="story-drawer-form">
              초대 code 만들기
            </Button>
          }
        >
          <form id="story-drawer-form" aria-label="운영자 초대" className="flex flex-col gap-4">
            <TextField id="story-drawer-email" name="email" type="email" label="이메일" />
          </form>
        </Overlay>
      ) : null}
    </>
  );
}

/**
 * A drawer takes focus when it opens, keeps it inside (the page behind is inert) and gives it back to the control that
 * opened it when Escape closes it (web-fe-accessibility F2). The story check runs this play.
 */
export const Drawer: Story = {
  render: () => <DrawerExample />,
  play: async ({ canvas, userEvent }) => {
    const opener = canvas.getByRole('button', { name: 'drawer 열기' });
    await userEvent.click(opener);
    const dialog = await canvas.findByRole('dialog', { name: '운영자 초대' });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(canvas.queryByRole('dialog')).toBeNull());
    await expect(opener).toHaveFocus();
  },
};

function ConfirmExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button tone="danger" className="self-start" onClick={() => setOpen(true)}>
        비활성화
      </Button>
      {open ? (
        <Overlay
          id="story-confirm"
          variant="confirm"
          title="계정 비활성화"
          description="운영자 하나 계정을 비활성화합니다. 그 계정의 역할과 접속도 끝납니다."
          onClose={() => setOpen(false)}
          footer={
            <Button type="submit" form="story-confirm-form" tone="danger-solid">
              비활성화
            </Button>
          }
        >
          <form id="story-confirm-form" aria-label="계정 비활성화">
            <TextAreaField id="story-confirm-reason" name="reason" label="비활성화 사유" />
          </form>
        </Overlay>
      ) : null}
    </>
  );
}

/** A risky confirmation: the same focus contract, closed by Escape and by its own close button. */
export const Confirm: Story = {
  render: () => <ConfirmExample />,
  play: async ({ canvas, userEvent }) => {
    const opener = canvas.getByRole('button', { name: '비활성화' });
    for (const close of ['escape', 'button'] as const) {
      await userEvent.click(opener);
      const dialog = await canvas.findByRole('alertdialog', { name: '계정 비활성화' });
      await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
      if (close === 'escape') await userEvent.keyboard('{Escape}');
      else await userEvent.click(canvas.getByRole('button', { name: '닫기' }));
      await waitFor(() => expect(canvas.queryByRole('alertdialog')).toBeNull());
      await expect(opener).toHaveFocus();
    }
  },
};
