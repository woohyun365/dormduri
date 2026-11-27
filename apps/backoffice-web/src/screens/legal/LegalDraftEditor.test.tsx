import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { legalDraftUpdateRequestSchema, type LegalDraft } from '@repo/shared/backoffice';
import type { LegalDraftDetail } from './legal-types';
import { LegalDraftEditor } from './LegalDraftEditor';

// The section structure editor (backoffice-web README legal section): a table keeps its cells in rows and columns, a
// save sends the shared import body at the revision the editor read, and the editor refuses what the contract refuses
// before calling the BFF.

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const browser = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', () => browser);

const DRAFT_ID = '5a1f0c2e-0000-4000-8000-0000000000d1';
const AUTHOR = '1a7c3e90-0000-4000-8000-000000000001';
const SAVE_URL = `/api/legal/drafts/${DRAFT_ID}`;
const fetchMock = vi.fn<typeof fetch>();

function draft(overrides: Partial<LegalDraft> = {}): LegalDraft {
  return {
    id: DRAFT_ID,
    kind: 'PRIVACY_POLICY',
    status: 'EDITING',
    revision: 4,
    basedOnVersionId: 'privacy-2026-06-22',
    authorAccountId: AUTHOR,
    content: {
      kind: 'PRIVACY_POLICY',
      contentSchemaVersion: 1,
      title: '개인정보 처리방침',
      summaryItems: ['보유 기간 표를 고칩니다.'],
      sections: [
        { type: 'heading', level: 2, text: '제1조(보유 기간)' },
        {
          type: 'table',
          caption: '보유 기간',
          headers: ['항목', '기간'],
          rows: [['접속 기록', '3개월']],
        },
      ],
      changeSummary: '보유 기간 표에 근거 열을 더합니다.',
      noticeClass: 'GENERAL',
      consentRequired: false,
      proposedEffectiveDate: '2026-12-10',
      appliesUntil: null,
    },
    contentDigest: 'c'.repeat(64),
    createdAt: '2026-11-25T01:00:00.000Z',
    updatedAt: '2026-11-25T02:00:00.000Z',
    ...overrides,
  };
}

function detail(overrides: Partial<LegalDraft> = {}): LegalDraftDetail {
  return { draft: draft(overrides), previousVersion: null, comparison: [] };
}

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  router.push.mockReset();
  router.refresh.mockReset();
});

describe('LegalDraftEditor', () => {
  it('adds and deletes table columns and rows and saves a body the contract accepts', async () => {
    fetchMock.mockResolvedValue(respond(200, draft({ revision: 5 })));
    render(<LegalDraftEditor detail={detail()} accounts={null} canEdit />);
    const table = screen.getByRole('group', { name: '본문 2 · 표' });

    await userEvent.click(within(table).getByRole('button', { name: '열 더하기' }));
    await userEvent.type(within(table).getByRole('textbox', { name: '머리 3' }), '근거');
    await userEvent.type(within(table).getByRole('textbox', { name: '1행 3열' }), '통신비밀보호법');
    await userEvent.click(within(table).getByRole('button', { name: '행 더하기' }));
    await userEvent.type(within(table).getByRole('textbox', { name: '2행 1열' }), '감사 기록');
    await userEvent.type(within(table).getByRole('textbox', { name: '2행 2열' }), '3년');
    await userEvent.type(within(table).getByRole('textbox', { name: '2행 3열' }), '내부 규정');
    await userEvent.click(within(table).getByRole('button', { name: '2열 지우기' }));
    expect(within(table).queryByRole('textbox', { name: '머리 3' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(SAVE_URL);
    const body: unknown = JSON.parse(String(init!.body));
    expect(legalDraftUpdateRequestSchema.safeParse(body).error?.issues).toBeUndefined();
    expect(body).toMatchObject({
      revision: 4,
      draft: {
        kind: 'PRIVACY_POLICY',
        sections: [
          { type: 'heading', level: 2, text: '제1조(보유 기간)' },
          {
            type: 'table',
            caption: '보유 기간',
            headers: ['항목', '근거'],
            rows: [
              ['접속 기록', '통신비밀보호법'],
              ['감사 기록', '내부 규정'],
            ],
          },
        ],
      },
    });
    expect(body).not.toHaveProperty('draft.appliesUntil');
    expect(await screen.findByRole('status')).toHaveTextContent('초안을 저장했습니다.');
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it('refuses to save an empty cell, naming where, before calling the BFF', async () => {
    render(<LegalDraftEditor detail={detail()} accounts={null} canEdit />);
    const table = screen.getByRole('group', { name: '본문 2 · 표' });
    await userEvent.click(within(table).getByRole('button', { name: '열 더하기' }));
    await userEvent.type(within(table).getByRole('textbox', { name: '머리 3' }), '근거');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('본문 2(표)');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adds, moves and deletes sections', async () => {
    fetchMock.mockResolvedValue(respond(200, draft({ revision: 5 })));
    render(<LegalDraftEditor detail={detail()} accounts={null} canEdit />);
    await userEvent.click(screen.getByRole('button', { name: '문단 더하기' }));
    const added = screen.getByRole('group', { name: '본문 3 · 문단' });
    await userEvent.type(within(added).getByRole('textbox', { name: '문단' }), '새 문단');
    await userEvent.click(within(added).getByRole('button', { name: '본문 3 위로 옮기기' }));
    expect(screen.getByRole('group', { name: '본문 2 · 문단' })).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('group', { name: '본문 3 · 표' })).getByRole('button', {
        name: '본문 3 지우기',
      }),
    );
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).draft.sections).toEqual([
      { type: 'heading', level: 2, text: '제1조(보유 기간)' },
      { type: 'paragraph', text: '새 문단' },
    ]);
  });

  it('asks for a save before a publish request while changes are unsaved', async () => {
    render(<LegalDraftEditor detail={detail()} accounts={null} canEdit />);
    const request = screen.getByRole('button', { name: '게시 승인 요청' });
    expect(request).toBeEnabled();
    await userEvent.type(screen.getByRole('textbox', { name: '제목' }), ' 개정');
    expect(request).toBeDisabled();
    expect(screen.getByText('저장하지 않은 변경이 있습니다. 저장한 뒤 요청하세요.')).toBeVisible();
  });

  it('saves at the revision the screen edits when a newer one arrives with unsaved changes', async () => {
    fetchMock.mockResolvedValue(respond(409, { error: { code: 'conflict' } }));
    const { rerender } = render(<LegalDraftEditor detail={detail()} accounts={null} canEdit />);
    await userEvent.type(screen.getByRole('textbox', { name: '제목' }), ' 개정');
    // Another operator saved; the page read it again (router.refresh after this screen's own action).
    const newer = draft({ revision: 5 });
    rerender(
      <LegalDraftEditor
        detail={{
          ...detail(),
          draft: { ...newer, content: { ...newer.content, title: '다른 제목' } },
        }}
        accounts={null}
        canEdit
      />,
    );
    expect(screen.getByRole('textbox', { name: '제목' })).toHaveValue('개인정보 처리방침 개정');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).revision).toBe(4);
    expect(await screen.findByRole('alert')).toHaveTextContent('이미 처리됐거나');
  });

  it('moves focus to the result once the discard removes the button that opened it', async () => {
    fetchMock.mockResolvedValue(respond(200, draft({ status: 'DISCARDED', revision: 5 })));
    render(<LegalDraftEditor detail={detail()} accounts={null} canEdit />);
    await userEvent.click(screen.getByRole('button', { name: '초안 버리기' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog', { name: '초안 버리기' })).getByRole('button', {
        name: '버리기',
      }),
    );
    const text = await screen.findByText('초안을 버렸습니다.');
    await waitFor(() => expect(text.closest('[role="status"]')).toHaveFocus());
    expect(screen.queryByRole('button', { name: '초안 버리기' })).toBeNull();
  });

  it('keeps the publish request closed until the page reads the waiting draft', async () => {
    fetchMock.mockResolvedValue(
      respond(200, {
        id: '6b2e1d3f-0000-4000-8000-0000000000e1',
        kind: 'LEGAL_PUBLISH',
        status: 'PENDING',
        contentDigest: 'c'.repeat(64),
        targetLegalDraftId: DRAFT_ID,
        targetLegalVersionId: null,
        requestedByAccountId: AUTHOR,
        requestReason: null,
        expiresAt: '2026-12-02T01:00:00.000Z',
        decidedByAccountId: null,
        closedAt: null,
        decisionReason: null,
        selfApproved: false,
        createdAt: '2026-11-25T03:00:00.000Z',
      }),
    );
    render(<LegalDraftEditor detail={detail()} accounts={null} canEdit />);
    await userEvent.click(screen.getByRole('button', { name: '게시 승인 요청' }));
    expect(await screen.findByText(/게시 승인을 요청했습니다/u)).toBeVisible();
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '게시 승인 요청' })).toBeDisabled();
  });

  it('keeps a draft waiting for approval read-only and points at the waiting requests', () => {
    render(
      <LegalDraftEditor detail={detail({ status: 'PENDING_APPROVAL' })} accounts={null} canEdit />,
    );
    expect(screen.getByRole('textbox', { name: '제목' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
    expect(screen.queryByRole('button', { name: '게시 승인 요청' })).toBeNull();
    expect(screen.getByRole('link', { name: '게시 요청 보기' })).toHaveAttribute(
      'href',
      '/legal/requests?status=PENDING',
    );
  });
});
