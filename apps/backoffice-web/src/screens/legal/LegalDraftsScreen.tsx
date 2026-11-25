'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  legalDraftCreateRequestSchema,
  type AccountListResponse,
  type LegalDraft,
  type LegalDraftStatus,
  type PageCursor,
} from '@repo/shared/backoffice';
import { legalDocumentKindSchema, type LegalDocumentKind } from '@repo/shared/legal';
import { postBff } from '@/client/bff-client';
import { accountName } from '@/ui/account-name';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { formatKstShort } from '@/ui/format';
import { Icon } from '@/ui/icons';
import {
  LEGAL_DRAFT_STATUS_LABELS,
  LEGAL_KIND_LABELS,
  LEGAL_NOTICE_CLASS_LABELS,
} from '@/ui/labels';
import { Notice } from '@/ui/Notice';
import { Overlay } from '@/ui/Overlay';
import { PageHeader } from '@/ui/PageHeader';
import { failureText, useFailure, type ResultMessage } from '@/ui/result-message';
import { LEGAL_DRAFT_STATUS_MEANING, StatusBadge } from '@/ui/status';
import { StatusFilter } from '@/ui/StatusFilter';
import { TableRegion, TD, TH } from '@/ui/table';
import { TextLink } from '@/ui/TextLink';
import { describeIssues, type SectionType } from './draft-form';

const STATUS_FILTERS: readonly { status: LegalDraftStatus | null; label: string }[] = [
  { status: null, label: '전체' },
  { status: 'EDITING', label: '편집 중' },
  { status: 'PENDING_APPROVAL', label: '승인 대기' },
  { status: 'PUBLISHED', label: '게시됨' },
  { status: 'DISCARDED', label: '버림' },
];

function draftsHref(
  kind: LegalDocumentKind | null,
  status: LegalDraftStatus | null,
  extra: Record<string, string> = {},
): Route {
  const query = new URLSearchParams({
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
    ...extra,
  }).toString();
  return (query ? `/legal/drafts?${query}` : '/legal/drafts') as Route;
}

function sectionTypes(value: unknown): SectionType[] {
  const sections = (value as { sections?: unknown } | null)?.sections;
  return Array.isArray(sections)
    ? sections.map((section) => (section as { type?: SectionType } | null)?.type ?? 'paragraph')
    : [];
}

/**
 * The JSON import (D-LC9): the operator picks a file the seed export command wrote (or a first revision draft); the
 * browser reads it, checks it with the shared import schema and sends it as an `import` draft. The new draft opens in
 * the editor. A failure stays in the drawer with the file chosen.
 */
function ImportDrawer({ onClose }: { readonly onClose: () => void }) {
  const router = useRouter();
  const failure = useFailure();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<ResultMessage | null>(null);
  const [file, setFile] = useState<File | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage(failureText('가져올 JSON 파일을 고르세요.'));
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setMessage(failureText('JSON 파일을 읽지 못했습니다. 파일 내용을 확인하세요.'));
      return;
    }
    const body = { source: 'import', draft: json };
    const parsed = legalDraftCreateRequestSchema.safeParse(body);
    if (!parsed.success) {
      const lines = describeIssues(parsed.error.issues, sectionTypes(json), 1);
      setMessage(failureText(`가져오기 형식에 맞지 않습니다. ${lines.join(' ')}`));
      return;
    }
    setPending(true);
    setMessage(null);
    const result = await postBff<LegalDraft>('/api/legal/drafts', body);
    setPending(false);
    if (!result.ok) {
      setMessage(failure(result.code));
      return;
    }
    router.push(`/legal/drafts/${result.data.id}` as Route);
  }

  return (
    <Overlay
      id="legal-import"
      title="JSON 파일로 초안 만들기"
      busy={pending}
      onClose={onClose}
      footer={
        <Button type="submit" form="legal-import-form" disabled={pending}>
          초안 만들기
        </Button>
      }
    >
      <form
        id="legal-import-form"
        aria-label="JSON 파일 가져오기"
        className="flex flex-col gap-4"
        onSubmit={(event) => void submit(event)}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="legal-import-file" className="text-label font-semibold text-fg-label">
            가져올 JSON 파일
          </label>
          <input
            id="legal-import-file"
            name="file"
            type="file"
            accept="application/json,.json"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            aria-describedby="legal-import-file-hint"
            className="text-body text-fg-neutral focus-ring"
          />
          <p id="legal-import-file-hint" className="text-caption text-fg-muted">
            가져오기 형식(공유 가져오기 schema)의 파일입니다. 첫 게시 파일은 저장소의 내보내기
            명령으로 만듭니다(운영 runbook). 파일은 이 화면에서 먼저 검사합니다.
          </p>
        </div>
        {message ? (
          <Notice tone={message.tone} role={message.role}>
            {message.text}
          </Notice>
        ) : null}
      </form>
    </Overlay>
  );
}

/**
 * Legal drafts as a list with filters (design guide ④): kind and status are the URL query the API takes, the next page
 * keeps the API's keyset link, and the page's one action imports a JSON file. A draft opens in the editor.
 */
export function LegalDraftsScreen({
  drafts,
  accounts,
  canEdit,
  kind,
  status,
  nextPage,
}: {
  readonly drafts: readonly LegalDraft[];
  readonly accounts: AccountListResponse['accounts'] | null;
  readonly canEdit: boolean;
  readonly kind: LegalDocumentKind | null;
  readonly status: LegalDraftStatus | null;
  readonly nextPage: PageCursor | null;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const filtered = kind !== null || status !== null;
  return (
    <>
      <PageHeader
        title="초안"
        meta={`이 목록 ${drafts.length}건`}
        actions={
          canEdit ? (
            <Button onClick={() => setImportOpen(true)}>
              <Icon name="plus" className="size-4" />
              JSON 파일로 초안 만들기
            </Button>
          ) : null
        }
      />
      <div className="flex flex-col gap-3">
        <StatusFilter
          label="문서"
          items={[null, ...legalDocumentKindSchema.options].map((option) => ({
            key: option ?? 'all',
            label: option ? LEGAL_KIND_LABELS[option] : '모든 문서',
            href: draftsHref(option, status),
            current: option === kind,
          }))}
        />
        <StatusFilter
          label="초안 상태"
          items={STATUS_FILTERS.map((filter) => ({
            key: filter.label,
            label: filter.label,
            href: draftsHref(kind, filter.status),
            current: filter.status === status,
          }))}
        />
      </div>
      {drafts.length === 0 ? (
        filtered ? (
          <EmptyState
            icon="draft"
            title="이 조건의 초안이 없습니다."
            action={
              <TextLink href="/legal/drafts" className="text-body">
                모든 초안 보기
              </TextLink>
            }
          />
        ) : (
          <EmptyState icon="draft" title="초안이 없습니다.">
            JSON 파일로 초안을 만들거나 문서 판에서 그 판으로 새 초안을 만듭니다.
          </EmptyState>
        )
      ) : (
        <Card id="legal-drafts" flush>
          <TableRegion label="초안 목록">
            <table className="w-full min-w-160 border-t border-stroke-subtle lg:max-xl:min-w-0">
              <thead>
                <tr>
                  <th scope="col" className={TH}>
                    문서
                  </th>
                  <th scope="col" className={TH}>
                    제목
                  </th>
                  <th scope="col" className={TH}>
                    고지 등급
                  </th>
                  <th scope="col" className={TH}>
                    제안 시행일
                  </th>
                  <th scope="col" className={TH}>
                    상태
                  </th>
                  <th scope="col" className={TH}>
                    작성자
                  </th>
                  <th scope="col" className={TH}>
                    마지막 저장(KST)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stroke-row">
                {drafts.map((draft) => (
                  <tr key={draft.id}>
                    <td className={TD}>{LEGAL_KIND_LABELS[draft.kind]}</td>
                    <td className={`${TD} min-w-48 font-semibold wrap-anywhere`}>
                      <TextLink href={`/legal/drafts/${draft.id}` as Route}>
                        {draft.content.title}
                      </TextLink>
                    </td>
                    <td className={TD}>{LEGAL_NOTICE_CLASS_LABELS[draft.content.noticeClass]}</td>
                    <td className={`${TD} tabular-nums`}>{draft.content.proposedEffectiveDate}</td>
                    <td className={TD}>
                      <StatusBadge meaning={LEGAL_DRAFT_STATUS_MEANING[draft.status]}>
                        {LEGAL_DRAFT_STATUS_LABELS[draft.status]}
                      </StatusBadge>
                    </td>
                    <td className={TD}>{accountName(accounts, draft.authorAccountId)}</td>
                    <td className={`${TD} tabular-nums`}>{formatKstShort(draft.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
        </Card>
      )}
      {nextPage ? (
        <TextLink href={draftsHref(kind, status, { ...nextPage })} className="self-start text-body">
          다음 초안 보기
        </TextLink>
      ) : null}
      {importOpen ? <ImportDrawer onClose={() => setImportOpen(false)} /> : null}
    </>
  );
}
