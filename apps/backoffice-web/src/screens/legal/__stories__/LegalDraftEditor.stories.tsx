import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { within } from 'storybook/test';
import { answerBff, bffFailure } from '../../../ui/__stories__/bff-stub';
import { accountList, activeAuditor } from '../../../ui/__stories__/fixtures';
import { consoleFrame } from '../../../ui/__stories__/frames';
import {
  legalDraftDetail,
  legalFirstDraftDetail,
  legalLongDraftDetail,
  legalPendingDraftDetail,
} from '../../../ui/__stories__/legal-fixtures';
import { Forbidden as ForbiddenPage } from '../../../ui/Forbidden';
import { LegalDraftEditor } from '../LegalDraftEditor';

// The legal draft editor inside the console shell: the basic fields, the summary items, the change summary, the section
// structure editor, the preview of the screen's content and the comparison the API computed for the saved draft.

const draft = legalDraftDetail.draft;

const meta = {
  title: 'Legal/Draft editor',
  component: LegalDraftEditor,
  decorators: [consoleFrame],
  args: { detail: legalDraftDetail, accounts: accountList.accounts, canEdit: true },
  parameters: { nextjs: { navigation: { pathname: `/legal/drafts/${draft.id}` } } },
} satisfies Meta<typeof LegalDraftEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A general revision of the privacy policy: a changed, an added and a removed article in the comparison. */
export const Editing: Story = {};

/** A first publication imported from the seed export: no comparison, the whole text to read. */
export const FirstPublication: Story = { args: { detail: legalFirstDraftDetail } };

/** Waiting for approval: read-only, with the way to the request. */
export const PendingApproval: Story = { args: { detail: legalPendingDraftDetail } };

export const Discarded: Story = {
  args: { detail: { ...legalDraftDetail, draft: { ...draft, status: 'DISCARDED' } } },
};

/** A legal approver without the edit permission reads the draft. */
export const ReadOnly: Story = { args: { canEdit: false, accounts: null } };

/** A long joined title and thirty sections. */
export const LongContent: Story = { args: { detail: legalLongDraftDetail } };

const table = (canvas: Parameters<NonNullable<Story['play']>>[0]['canvas']) =>
  canvas.getByRole('group', { name: '본문 5 · 표' });

/** A column added and left empty: the save says where, before calling the BFF. */
export const SaveRefused: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(within(table(canvas)).getByRole('button', { name: '열 더하기' }));
    await userEvent.click(canvas.getByRole('button', { name: '저장' }));
    await canvas.findByText(/저장할 수 없습니다\. 본문 5\(표\)/u);
  },
};

/** A changed title saved: the result under the page title. */
export const Saved: Story = {
  beforeEach: () =>
    answerBff({ [`/api/legal/drafts/${draft.id}`]: { ...draft, revision: draft.revision + 1 } }),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: '제목' }), ' 개정');
    await userEvent.click(canvas.getByRole('button', { name: '저장' }));
    await canvas.findByText('초안을 저장했습니다.');
  },
};

/** Another operator saved first: the API's conflict under the page title, the changes kept. */
export const SaveConflict: Story = {
  beforeEach: () => answerBff({ [`/api/legal/drafts/${draft.id}`]: bffFailure(409, 'conflict') }),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: '제목' }), ' 개정');
    await userEvent.click(canvas.getByRole('button', { name: '저장' }));
    await canvas.findByText(
      '이미 처리됐거나 지금 상태에서는 할 수 없는 작업입니다. 화면을 새로 고쳐 확인하세요.',
    );
  },
};

/** Unsaved changes keep the publish request closed. */
export const UnsavedChanges: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: '제목' }), ' 개정');
    await canvas.findByText('저장하지 않은 변경이 있습니다. 저장한 뒤 요청하세요.');
  },
};

export const PublishRequested: Story = {
  beforeEach: () =>
    answerBff({
      [`/api/legal/drafts/${draft.id}/publish-requests`]: {
        id: 'f708192a-0000-4000-8000-00000000c001',
        kind: 'LEGAL_PUBLISH',
        status: 'PENDING',
        contentDigest: draft.contentDigest,
        targetLegalDraftId: draft.id,
        targetLegalVersionId: null,
        requestedByAccountId: draft.authorAccountId,
        requestReason: null,
        expiresAt: '2026-12-03T09:00:00+09:00',
        decidedByAccountId: null,
        closedAt: null,
        decisionReason: null,
        selfApproved: false,
        createdAt: '2026-11-26T10:00:00+09:00',
      },
    }),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '게시 승인 요청' }));
    await canvas.findByText('게시 승인을 요청했습니다. 승인 권한 운영자가 결정합니다.');
  },
};

export const DiscardConfirm: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '초안 버리기' }));
    await canvas.findByRole('alertdialog', { name: '초안 버리기' });
  },
};

/** A menu link with unsaved changes asks before leaving. */
export const LeaveConfirm: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox', { name: '제목' }), ' 개정');
    // Below 1024px the menu opens first (design guide ③).
    const menu = canvas.queryByRole('button', { name: '메뉴' });
    if (menu) await userEvent.click(menu);
    await userEvent.click((await canvas.findAllByRole('link', { name: '게시 요청' }))[0]!);
    await canvas.findByRole('alertdialog', { name: '저장하지 않은 변경' });
  },
};

export const Narrow: Story = { globals: { viewport: { value: 'mobile390' } } };

export const Forbidden: Story = {
  render: () => <ForbiddenPage title="초안 편집" />,
  parameters: { consoleSession: activeAuditor },
};
