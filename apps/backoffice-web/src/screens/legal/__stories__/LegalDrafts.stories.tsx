import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { answerBff, bffFailure } from '../../../ui/__stories__/bff-stub';
import { accountList, activeAuditor, pageCursor } from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import {
  legalDrafts,
  legalLongAuthorAccountList,
  legalLongAuthorDrafts,
  manyLegalDrafts,
} from '../../../ui/__stories__/legal-fixtures';
import { Forbidden as ForbiddenPage } from '../../../ui/Forbidden';
import { LegalDraftsScreen } from '../LegalDraftsScreen';

// Legal drafts as a list with the kind and status filters inside the console shell, and the JSON import drawer.

const meta = {
  title: 'Legal/Drafts',
  component: LegalDraftsScreen,
  decorators: [consoleFrame],
  args: {
    drafts: legalDrafts,
    accounts: accountList.accounts,
    canEdit: true,
    kind: null,
    status: null,
    nextPage: pageCursor,
  },
  parameters: { nextjs: { navigation: { pathname: '/legal/drafts' } } },
} satisfies Meta<typeof LegalDraftsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Editing, waiting, published and left drafts; the left one has a long joined title. */
export const Drafts: Story = {};

/** A draft by an operator whose name is 80 characters without a space: the author cell breaks it (design guide ⑦). */
export const LongAuthorName: Story = {
  args: { drafts: legalLongAuthorDrafts, accounts: legalLongAuthorAccountList.accounts },
};

export const Rows: Story = { args: { drafts: manyLegalDrafts, nextPage: null } };

export const Empty: Story = { args: { drafts: [], nextPage: null } };

/** An empty filter result, apart from an empty list, with the way back to every draft. */
export const FilteredEmpty: Story = {
  args: { drafts: [], kind: 'TERMS_OF_SERVICE', status: 'PENDING_APPROVAL', nextPage: null },
};

/** A legal approver without the edit permission reads the drafts and has no import. */
export const ReadOnly: Story = { args: { canEdit: false, accounts: null } };

const openImport: NonNullable<Story['play']> = async ({ canvas, userEvent }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'JSON 파일로 초안 만들기' }));
  await canvas.findByRole('dialog', { name: 'JSON 파일로 초안 만들기' });
};

export const ImportDrawer: Story = { play: openImport };

/** A file that is not JSON stays in the drawer with the reason. */
export const ImportNotJson: Story = {
  play: async (context) => {
    await openImport(context);
    const dialog = await context.canvas.findByRole('dialog', { name: 'JSON 파일로 초안 만들기' });
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    await context.userEvent.upload(
      input,
      new File(['{ not json'], 'draft.import.json', { type: 'application/json' }),
    );
    await context.userEvent.click(context.canvas.getByRole('button', { name: '초안 만들기' }));
    await context.canvas.findByText('JSON 파일을 읽지 못했습니다. 파일 내용을 확인하세요.');
  },
};

/** The API refused the import (another operator's change or a broken session): the failure stays in the drawer. */
export const ImportRefused: Story = {
  beforeEach: () => answerBff({ '/api/legal/drafts': bffFailure(409, 'conflict') }),
  play: async (context) => {
    await openImport(context);
    const dialog = await context.canvas.findByRole('dialog', { name: 'JSON 파일로 초안 만들기' });
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    const body = {
      kind: 'AGE_14_OR_ABOVE_NOTICE',
      contentSchemaVersion: 1,
      title: '만 14세 이상 확인',
      summaryItems: [],
      sections: [{ type: 'paragraph', text: '만 14세 이상만 가입할 수 있습니다.' }],
      changeSummary: '첫 게시',
      noticeClass: 'INITIAL',
      consentRequired: false,
      proposedEffectiveDate: '2026-06-22',
    };
    await context.userEvent.upload(
      input,
      new File([JSON.stringify(body)], 'age.import.json', { type: 'application/json' }),
    );
    await context.userEvent.click(context.canvas.getByRole('button', { name: '초안 만들기' }));
    await context.canvas.findByText(
      '이미 처리됐거나 지금 상태에서는 할 수 없는 작업입니다. 화면을 새로 고쳐 확인하세요.',
    );
  },
};

export const Narrow: Story = { globals: { viewport: { value: 'mobile390' } } };

export const Forbidden: Story = {
  render: () => <ForbiddenPage title="초안" />,
  parameters: { consoleSession: activeAuditor },
};
