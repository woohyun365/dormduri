import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LegalBackofficeVersionDetail, LegalDraft } from '@repo/shared/backoffice';
import { LegalVersionScreen } from './LegalVersionScreen';

// A published version (backoffice-api README §8): a scheduled general or significant version can be asked to be
// withdrawn after a passkey re-authentication, and any version can start a new draft from its text.

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const browser = vi.hoisted(() => ({ startAuthentication: vi.fn(), startRegistration: vi.fn() }));
vi.mock('@simplewebauthn/browser', () => browser);

const VERSION_ID = '8d4a3f51-0000-4000-8000-0000000000f1';
const NEW_ID = '5a1f0c2e-0000-4000-8000-0000000000d8';
const OWNER = '1a7c3e90-0000-4000-8000-000000000001';
const fetchMock = vi.fn<typeof fetch>();

const VERSION: LegalBackofficeVersionDetail = {
  id: VERSION_ID,
  kind: 'PRIVACY_POLICY',
  version: VERSION_ID,
  title: '개인정보 처리방침',
  changeSummary: '접속 기록 보관 기간을 고칩니다.',
  noticeClass: 'GENERAL',
  consentRequired: false,
  effectiveDate: '2026-12-10',
  appliesUntil: null,
  contentDigest: 'a'.repeat(64),
  publishedAt: '2026-11-25T01:00:00.000Z',
  withdrawnAt: null,
  requestedByAccountId: OWNER,
  approvedByAccountId: OWNER,
  selfApproved: true,
  contentSchemaVersion: 1,
  summaryItems: ['접속 기록을 3년 보관합니다.'],
  sections: [
    { type: 'heading', level: 2, text: '제1조(보유 기간)' },
    { type: 'paragraph', text: '접속 기록은 3년 보관합니다.' },
  ],
};

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

describe('LegalVersionScreen', () => {
  it('asks to withdraw a scheduled version with a reason after a confirmation', async () => {
    fetchMock.mockResolvedValue(
      respond(200, {
        id: '6b2e1d3f-0000-4000-8000-0000000000e9',
        kind: 'LEGAL_WITHDRAW',
        status: 'PENDING',
        contentDigest: 'a'.repeat(64),
        targetLegalDraftId: null,
        targetLegalVersionId: VERSION_ID,
        requestedByAccountId: OWNER,
        requestReason: '시행일을 다시 정함',
        expiresAt: '2026-12-02T01:00:00.000Z',
        decidedByAccountId: null,
        closedAt: null,
        decisionReason: null,
        selfApproved: false,
        createdAt: '2026-11-25T02:00:00.000Z',
      }),
    );
    render(<LegalVersionScreen version={VERSION} state="scheduled" canEdit />);
    expect(screen.getByRole('article', { name: '본문' })).toHaveTextContent(
      '접속 기록은 3년 보관합니다.',
    );
    await userEvent.click(screen.getByRole('button', { name: '철회 요청' }));
    const confirm = screen.getByRole('alertdialog', { name: '철회 요청' });
    await userEvent.type(
      within(confirm).getByRole('textbox', { name: '철회 사유(선택)' }),
      '시행일을 다시 정함',
    );
    await userEvent.click(within(confirm).getByRole('button', { name: '철회 요청 만들기' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      '철회 요청을 만들었습니다. 승인 권한 운영자가 결정합니다.',
    );
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/legal/versions/${VERSION_ID}/withdraw-requests`);
    expect(JSON.parse(String(init!.body))).toEqual({ reason: '시행일을 다시 정함' });
  });

  it('offers no withdrawal for a version in effect', () => {
    render(<LegalVersionScreen version={VERSION} state="current" canEdit />);
    expect(screen.queryByRole('button', { name: '철회 요청' })).toBeNull();
  });

  it('starts a new draft from the version text and opens it', async () => {
    const created: LegalDraft = {
      id: NEW_ID,
      kind: 'PRIVACY_POLICY',
      status: 'EDITING',
      revision: 1,
      basedOnVersionId: VERSION_ID,
      authorAccountId: OWNER,
      content: {
        kind: 'PRIVACY_POLICY',
        contentSchemaVersion: 1,
        title: VERSION.title,
        summaryItems: VERSION.summaryItems,
        sections: VERSION.sections,
        changeSummary: '수탁자 목록을 고칩니다.',
        noticeClass: 'GENERAL',
        consentRequired: false,
        proposedEffectiveDate: '2027-01-10',
        appliesUntil: null,
      },
      contentDigest: 'b'.repeat(64),
      createdAt: '2026-11-25T02:00:00.000Z',
      updatedAt: '2026-11-25T02:00:00.000Z',
    };
    fetchMock.mockResolvedValue(respond(200, created));
    render(<LegalVersionScreen version={VERSION} state="current" canEdit />);
    await userEvent.click(screen.getByRole('button', { name: '이 판으로 새 초안 만들기' }));
    const drawer = screen.getByRole('dialog', { name: '이 판으로 새 초안' });
    await userEvent.type(
      within(drawer).getByRole('textbox', { name: '변경 요약' }),
      '수탁자 목록을 고칩니다.',
    );
    const date = within(drawer).getByLabelText('제안 시행일');
    await userEvent.clear(date);
    await userEvent.type(date, '2027-01-10');
    await userEvent.click(within(drawer).getByRole('button', { name: '초안 만들기' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/legal/drafts/${NEW_ID}`));
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({
      source: 'editor',
      draft: {
        kind: 'PRIVACY_POLICY',
        contentSchemaVersion: 1,
        title: VERSION.title,
        summaryItems: VERSION.summaryItems,
        sections: VERSION.sections,
        changeSummary: '수탁자 목록을 고칩니다.',
        noticeClass: 'GENERAL',
        consentRequired: false,
        proposedEffectiveDate: '2027-01-10',
      },
    });
  });
});
