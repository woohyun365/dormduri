import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LegalDraft } from '@repo/shared/backoffice';
import { LegalDraftsScreen } from './LegalDraftsScreen';

// The drafts list and its JSON import (backoffice-api README §8): a file is read in the browser, checked with the
// shared import schema, and sent as an `import` draft; the new draft opens in the editor.

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const NEW_ID = '5a1f0c2e-0000-4000-8000-0000000000d9';
const AUTHOR = '1a7c3e90-0000-4000-8000-000000000001';
const fetchMock = vi.fn<typeof fetch>();

const IMPORT = {
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

const CREATED: LegalDraft = {
  id: NEW_ID,
  kind: 'AGE_14_OR_ABOVE_NOTICE',
  status: 'EDITING',
  revision: 1,
  basedOnVersionId: null,
  authorAccountId: AUTHOR,
  content: {
    kind: 'AGE_14_OR_ABOVE_NOTICE',
    contentSchemaVersion: 1,
    title: IMPORT.title,
    summaryItems: [],
    sections: [{ type: 'paragraph', text: '만 14세 이상만 가입할 수 있습니다.' }],
    changeSummary: IMPORT.changeSummary,
    noticeClass: 'INITIAL',
    consentRequired: false,
    proposedEffectiveDate: IMPORT.proposedEffectiveDate,
    appliesUntil: null,
  },
  contentDigest: 'f'.repeat(64),
  createdAt: '2026-11-25T01:00:00.000Z',
  updatedAt: '2026-11-25T01:00:00.000Z',
};

function renderScreen() {
  render(
    <LegalDraftsScreen
      drafts={[]}
      accounts={null}
      canEdit
      kind={null}
      status={null}
      nextPage={null}
    />,
  );
}

async function openImport() {
  await userEvent.click(screen.getByRole('button', { name: 'JSON 파일로 초안 만들기' }));
  return screen.getByRole('dialog', { name: 'JSON 파일로 초안 만들기' });
}

function file(text: string) {
  return new File([text], 'draft.import.json', { type: 'application/json' });
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  router.push.mockReset();
});

describe('LegalDraftsScreen import', () => {
  it('sends a file that passes the import schema and opens the new draft', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(CREATED), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderScreen();
    const dialog = await openImport();
    await userEvent.upload(
      within(dialog).getByLabelText('가져올 JSON 파일'),
      file(JSON.stringify(IMPORT)),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: '초안 만들기' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/legal/drafts/${NEW_ID}`));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/legal/drafts');
    expect(JSON.parse(String(init!.body))).toEqual({ source: 'import', draft: IMPORT });
  });

  it('says a file is not JSON without calling the BFF', async () => {
    renderScreen();
    const dialog = await openImport();
    await userEvent.upload(within(dialog).getByLabelText('가져올 JSON 파일'), file('{ not json'));
    await userEvent.click(within(dialog).getByRole('button', { name: '초안 만들기' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'JSON 파일을 읽지 못했습니다. 파일 내용을 확인하세요.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says where a file breaks the import schema without calling the BFF', async () => {
    renderScreen();
    const dialog = await openImport();
    await userEvent.upload(
      within(dialog).getByLabelText('가져올 JSON 파일'),
      file(JSON.stringify({ ...IMPORT, noticeClass: 'HISTORICAL' })),
    );
    await userEvent.click(within(dialog).getByRole('button', { name: '초안 만들기' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('적용 끝');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
